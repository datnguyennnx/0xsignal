import { randomBytes } from "node:crypto";
import { Context, Effect, Layer, Option } from "effect";
import type { PostgresConnectionPool } from "@0xsignal/auth";
import { AlertsConfig, AlertsConfigLayer, type AlertsConfigService } from "../config";
import { AlertsErrors, type AlertsError } from "../errors";
import { subjectKey, type Subject } from "../table";
import { ChannelsRepository, ChannelsRepositoryLayer } from "./repository";
import { telegramDeepLink } from "./telegram";
import type { ChannelName, ChannelRow } from "./table";

export type { ChannelRow } from "./table";

const CHANNEL_LIMIT = 5;
const CODE_LENGTH = 8;
// 32 symbols divides 256, so a byte maps uniformly without rejection sampling.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LINK_TTL_MS = 10 * 60 * 1000;

interface CreateLinkResult {
  readonly code: string;
  readonly expiresAt: string;
  readonly deepLink: string | null;
}

interface ConsumedLink {
  readonly subject: Subject;
  readonly channel: ChannelName;
}

export interface ChannelsServicePort {
  readonly list: (subject: Subject) => Effect.Effect<ChannelRow[], AlertsError>;

  readonly createLink: (
    subject: Subject,
    channel: ChannelName,
    now: number,
  ) => Effect.Effect<CreateLinkResult, AlertsError>;

  readonly consumeLink: (
    code: string,
    now: number,
  ) => Effect.Effect<ConsumedLink | null, AlertsError>;

  readonly bindChannel: (
    subject: Subject,
    channel: ChannelName,
    destination: string,
    label: string | null,
    now: number,
  ) => Effect.Effect<ChannelRow, AlertsError>;

  readonly unlink: (
    subject: Subject,
    channelId: string,
    now: number,
  ) => Effect.Effect<void, AlertsError>;

  readonly markSent: (channelId: string) => Effect.Effect<void, AlertsError>;

  readonly markError: (channelId: string, message: string) => Effect.Effect<void, AlertsError>;

  readonly forSubjects: (
    subjects: readonly Subject[],
  ) => Effect.Effect<Map<string, ChannelRow[]>, AlertsError>;
}

export class ChannelsService extends Context.Service<ChannelsService, ChannelsServicePort>()(
  "ChannelsService",
) {}

const generateCode = (): string => {
  let code = "";
  for (const byte of randomBytes(CODE_LENGTH)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
};

const optionOrNull = <A>(value: Option.Option<A> | undefined): A | null =>
  value === undefined ? null : Option.getOrNull(value);

const deepLinkFor = (
  config: AlertsConfigService,
  channel: ChannelName,
  code: string,
): string | null => {
  if (channel !== "telegram") return null;
  const username = optionOrNull(config.telegramBotUsername);
  return username === null || username === "" ? null : telegramDeepLink(username, code);
};

const resolvedLabel = (label: string | null, destination: string): string => {
  if (label === null) return destination;
  const trimmed = label.trim();
  return trimmed === "" ? destination : trimmed;
};

const makeChannelsService = () =>
  Effect.gen(function* () {
    const repo = yield* ChannelsRepository;
    const config = yield* AlertsConfig;

    return ChannelsService.of({
      list: (subject) => repo.listBySubject(subject),

      createLink: (subject, channel, now) =>
        Effect.gen(function* () {
          const count = yield* repo.countBySubject(subject);
          if (count >= CHANNEL_LIMIT) {
            return yield* new AlertsErrors.LimitExceeded({ limit: CHANNEL_LIMIT });
          }

          const code = generateCode();
          const expiresAtMs = now + LINK_TTL_MS;
          yield* repo.insertLinkCode({
            code,
            subjectType: subject.type,
            subjectId: subject.id,
            channel,
            expiresAtMs,
          });

          return {
            code,
            expiresAt: new Date(expiresAtMs).toISOString(),
            deepLink: deepLinkFor(config, channel, code),
          };
        }),

      consumeLink: (code, now) =>
        Effect.map(repo.consumeLinkCode(code, now), (row) =>
          row === null
            ? null
            : { subject: { type: row.subjectType, id: row.subjectId }, channel: row.channel },
        ),

      bindChannel: (subject, channel, destination, label, now) =>
        repo.upsertChannel({
          subjectType: subject.type,
          subjectId: subject.id,
          channel,
          destination,
          label: resolvedLabel(label, destination),
          verifiedAtMs: now,
        }),

      unlink: (subject, channelId) =>
        Effect.flatMap(repo.remove(subject, channelId), (removed) =>
          removed ? Effect.void : Effect.fail(new AlertsErrors.NotFound({ id: channelId })),
        ),

      markSent: (channelId) => repo.touchSent(channelId),

      markError: (channelId, message) => repo.touchError(channelId, message),

      forSubjects: (subjects) =>
        Effect.gen(function* () {
          const rows = yield* repo.forSubjects(subjects);
          const grouped = new Map<string, ChannelRow[]>();

          for (const entry of rows) {
            const key = subjectKey({ type: entry.subjectType, id: entry.subjectId });
            const bucket = grouped.get(key);
            if (bucket === undefined) grouped.set(key, [entry.channel]);
            else bucket.push(entry.channel);
          }

          return grouped;
        }),
    });
  });

export const ChannelsServiceLayer: Layer.Layer<
  ChannelsService,
  never,
  ChannelsRepository | AlertsConfig
> = Layer.effect(ChannelsService, makeChannelsService());

// The channels API and the worker fan-out share this composition so both see
// the same repository recipe over the app's single pool.
export const ChannelsServiceWithInfra: Layer.Layer<ChannelsService, never, PostgresConnectionPool> =
  ChannelsServiceLayer.pipe(
    Layer.provide(ChannelsRepositoryLayer),
    Layer.provide(AlertsConfigLayer.pipe(Layer.orDie)),
  );
