import { Clock, Effect, Option, Redacted } from "effect";
import type { Notice } from "@0xsignal/shared/alerts";
import { errorMessage, type AlertsError } from "../errors";
import { subjectKey, type Subject } from "../table";
import { formatNotice } from "./format";
import { sendTelegram } from "./telegram";
import type { ChannelRow } from "./table";
import type { FetchLike, OutboundMessage, SendResult } from "./types";

const MAX_CONSECUTIVE_FAILURES = 5;
const SKIP_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_MS = 1000;

export interface FanoutDeps {
  readonly forSubjects: (
    subjects: readonly Subject[],
  ) => Effect.Effect<Map<string, ChannelRow[]>, AlertsError>;
  readonly markSent: (channelId: string) => Effect.Effect<void, AlertsError>;
  readonly markError: (channelId: string, message: string) => Effect.Effect<void, AlertsError>;
  readonly fetchImpl: FetchLike;
  readonly config: {
    readonly telegramBotToken: Option.Option<Redacted.Redacted>;
    readonly publicAppUrl?: Option.Option<string>;
  };
}

export interface Fanout {
  readonly deliver: (
    subject: Subject,
    notice: Notice,
    targets: readonly string[],
  ) => Effect.Effect<void>;
}

interface ChannelHealth {
  failures: number;
  skipUntil: number;
}

type Sender = () => Promise<SendResult>;

const manageUrlFor = (config: FanoutDeps["config"]): string | undefined => {
  const url = config.publicAppUrl;
  if (url === undefined || !Option.isSome(url)) return undefined;
  const base = url.value.trim();
  if (base === "") return undefined;
  return `${base.replace(/\/+$/, "")}/alerts`;
};

const telegramSender = (deps: FanoutDeps, row: ChannelRow, msg: OutboundMessage): Sender | null => {
  const configured = deps.config.telegramBotToken;
  if (!Option.isSome(configured)) return null;
  const token = Redacted.value(configured.value);
  if (token === "") return null;
  return () => sendTelegram(deps.fetchImpl, token, row.destination, msg);
};

const senderFor = (deps: FanoutDeps, row: ChannelRow, msg: OutboundMessage): Sender | null =>
  row.channel === "telegram" ? telegramSender(deps, row, msg) : null;

const retryDelayMs = (error: string): number => {
  const match = /retry_after (\d+(?:\.\d+)?)/.exec(error);
  if (match === null) return DEFAULT_RETRY_MS;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_RETRY_MS;
};

const sendWithRetry = (send: Sender): Effect.Effect<SendResult> =>
  Effect.gen(function* () {
    const first = yield* Effect.promise(send);
    if (first.ok || !first.retryable) return first;
    yield* Effect.sleep(retryDelayMs(first.error));
    return yield* Effect.promise(send);
  });

const recordFailure = (
  health: Map<string, ChannelHealth>,
  channelId: string,
  now: number,
): Effect.Effect<void> => {
  const previous = health.get(channelId);
  const failures = (previous?.failures ?? 0) + 1;

  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    health.set(channelId, { failures, skipUntil: now + SKIP_WINDOW_MS });
    return Effect.logWarning(
      `[alerts] channel ${channelId} failed ${failures} times in a row; skipping for 15 minutes`,
    );
  }

  health.set(channelId, { failures, skipUntil: previous?.skipUntil ?? 0 });
  return Effect.void;
};

const markSafely = (
  label: string,
  channelId: string,
  effect: Effect.Effect<void, AlertsError>,
): Effect.Effect<void> =>
  effect.pipe(
    Effect.catch((error) =>
      Effect.logWarning(`[alerts] channel ${channelId} ${label} failed: ${errorMessage(error)}`),
    ),
  );

const sendChannel = (
  deps: FanoutDeps,
  row: ChannelRow,
  msg: OutboundMessage,
  health: Map<string, ChannelHealth>,
  loggedMissing: Set<string>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const existing = health.get(row.id);
    if (existing !== undefined && now < existing.skipUntil) return;

    const send = senderFor(deps, row, msg);
    if (send === null) {
      if (!loggedMissing.has(row.id)) {
        loggedMissing.add(row.id);
        yield* Effect.logWarning(
          `[alerts] channel ${row.id} (${row.channel}) skipped: credentials not configured`,
        );
      }
      return;
    }

    const result = yield* sendWithRetry(send);
    if (result.ok) {
      health.delete(row.id);
      yield* markSafely("markSent", row.id, deps.markSent(row.id));
      return;
    }

    yield* markSafely("markError", row.id, deps.markError(row.id, result.error));
    yield* recordFailure(health, row.id, now);
  });

const IN_APP_TARGET = "inapp";

const channelTargetPredicate =
  (targets: readonly string[]) =>
  (channel: string): boolean => {
    const explicitExternal = targets.filter((target) => target !== IN_APP_TARGET);
    if (explicitExternal.length === 0) return true;
    return explicitExternal.includes(channel);
  };

export const createFanout = (deps: FanoutDeps): Fanout => {
  const health = new Map<string, ChannelHealth>();
  const loggedMissing = new Set<string>();

  return {
    deliver: (subject, notice, targets) =>
      Effect.gen(function* () {
        const shouldSendToChannel = channelTargetPredicate(targets);

        const grouped = yield* deps
          .forSubjects([subject])
          .pipe(
            Effect.catch((error) =>
              Effect.logWarning(`[alerts] channel lookup failed: ${errorMessage(error)}`).pipe(
                Effect.as(new Map<string, ChannelRow[]>()),
              ),
            ),
          );

        const rows = grouped.get(subjectKey(subject)) ?? [];
        if (rows.length === 0) return;

        const msg = formatNotice(notice, manageUrlFor(deps.config));
        for (const row of rows) {
          if (!shouldSendToChannel(row.channel)) continue;
          yield* sendChannel(deps, row, msg, health, loggedMissing);
        }
      }),
  };
};
