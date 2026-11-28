import { describe, expect, it } from "vitest";
import { Effect, Fiber, Option, Redacted } from "effect";
import { TestClock } from "effect/testing";
import type { Notice } from "@0xsignal/shared/alerts";
import { subjectKey, type Subject } from "../../table";
import { createFanout, type FanoutDeps } from "../fanout";
import type { ChannelRow } from "../table";
import type { FetchLike } from "../types";

const NOW = 1_700_000_000_000;
const SUBJECT: Subject = { type: "device", id: "device-1" };
const TELEGRAM_TOKEN = "bot-token";

const NOTICE: Notice = {
  ruleName: "BTC crosses 100",
  severity: "warn",
  summary: "BTC crossed 100",
  firedAt: NOW,
  payload: {},
};

const TELEGRAM_CONFIG: FanoutDeps["config"] = {
  telegramBotToken: Option.some(Redacted.make(TELEGRAM_TOKEN)),
};

const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

const channelRow = (overrides: Partial<ChannelRow> = {}): ChannelRow => ({
  id: "channel-1",
  channel: "telegram",
  destination: "chat-1",
  label: null,
  verifiedAt: null,
  lastError: null,
  lastSentAt: null,
  ...overrides,
});

const jsonReply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const telegramSuccess = (): Response => jsonReply({ ok: true, result: { message_id: 1 } });

interface FetchCall {
  readonly url: string;
}

const stubFetch = (
  reply: (callIndex: number) => Response,
): { fetchImpl: FetchLike; calls: FetchCall[] } => {
  const calls: FetchCall[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push({ url: input });
    return reply(calls.length - 1);
  };
  return { fetchImpl, calls };
};

interface Harness {
  readonly deps: FanoutDeps;
  readonly sent: string[];
  readonly errors: Array<{ id: string; message: string }>;
}

const harness = (
  rows: readonly ChannelRow[],
  fetchImpl: FetchLike,
  config: FanoutDeps["config"],
): Harness => {
  const sent: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  return {
    deps: {
      forSubjects: () => Effect.succeed(new Map([[subjectKey(SUBJECT), [...rows]]])),
      markSent: (id) => {
        sent.push(id);
        return Effect.void;
      },
      markError: (id, message) => {
        errors.push({ id, message });
        return Effect.void;
      },
      fetchImpl,
      config,
    },
    sent,
    errors,
  };
};

describe("createFanout", () => {
  it("sends once and marks the channel sent on success", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent, errors } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["telegram"]));

    expect(calls.map((call) => call.url)).toEqual([TELEGRAM_URL]);
    expect(sent).toEqual(["channel-1"]);
    expect(errors).toEqual([]);
  });

  it("reports a permanent rejection through markError and still resolves", async () => {
    const { fetchImpl, calls } = stubFetch(() =>
      jsonReply(
        { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
        403,
      ),
    );
    const { deps, sent, errors } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);

    await expect(
      Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["telegram"])),
    ).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    expect(sent).toEqual([]);
    expect(errors).toEqual([
      { id: "channel-1", message: "Forbidden: bot was blocked by the user" },
    ]);
  });

  it("retries a 5xx once and then reports the failure", async () => {
    const { fetchImpl, calls } = stubFetch(() => jsonReply({ ok: false }, 502));
    const { deps, sent, errors } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);
    const fanout = createFanout(deps);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const fiber = yield* fanout.deliver(SUBJECT, NOTICE, ["telegram"]).pipe(Effect.forkChild);
        yield* TestClock.adjust("1 second");
        yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    expect(calls).toHaveLength(2);
    expect(sent).toEqual([]);
    expect(errors).toEqual([{ id: "channel-1", message: "telegram server error 502" }]);
  });

  it("skips a connected channel with no token without marking it errored", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent, errors } = harness([channelRow()], fetchImpl, {
      telegramBotToken: Option.none(),
    });

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["telegram"]));

    expect(calls).toEqual([]);
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("skips channels not named in the rule targets", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["other"]));

    expect(calls).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("defaults an in-app-only rule to every connected external channel", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["inapp"]));

    expect(calls.map((call) => call.url)).toEqual([TELEGRAM_URL]);
    expect(sent).toEqual(["channel-1"]);
  });

  it("defaults an empty-target rule to every connected external channel", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, []));

    expect(calls.map((call) => call.url)).toEqual([TELEGRAM_URL]);
    expect(sent).toEqual(["channel-1"]);
  });

  it("sends nothing and reports no error when no channels are connected", async () => {
    const { fetchImpl, calls } = stubFetch(telegramSuccess);
    const { deps, sent, errors } = harness([], fetchImpl, TELEGRAM_CONFIG);

    await Effect.runPromise(createFanout(deps).deliver(SUBJECT, NOTICE, ["inapp"]));

    expect(calls).toEqual([]);
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("mutes a channel after five consecutive failures for fifteen minutes", async () => {
    const { fetchImpl, calls } = stubFetch(() =>
      jsonReply({ ok: false, description: "chat not found" }, 404),
    );
    const { deps, sent, errors } = harness([channelRow()], fetchImpl, TELEGRAM_CONFIG);
    const fanout = createFanout(deps);

    const beforeWindow = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        for (let delivery = 0; delivery < 6; delivery += 1) {
          yield* fanout.deliver(SUBJECT, NOTICE, ["telegram"]);
        }
        const blocked = { calls: calls.length, errors: errors.length };

        yield* TestClock.adjust("15 minutes");
        yield* fanout.deliver(SUBJECT, NOTICE, ["telegram"]);

        return blocked;
      }).pipe(Effect.provide(TestClock.layer())),
    );

    expect(beforeWindow).toEqual({ calls: 5, errors: 5 });
    expect(calls).toHaveLength(6);
    expect(sent).toEqual([]);
    expect(errors).toHaveLength(6);
  });
});
