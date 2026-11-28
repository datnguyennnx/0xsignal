import { describe, expect, it } from "vitest";
import { Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import type { Pool } from "pg";
import { PostgresConnectionPool } from "@0xsignal/auth";
import type { Rule } from "@0xsignal/shared/alerts";
import { HyperliquidProvider } from "../../../integrations/hyperliquid/data-sources/types";
import { AlertsConfig } from "../config";
import { AlertsNotifier } from "../notifier";
import { AlertsRepository } from "../repository";
import { INSERT_DELIVERY_SQL, SWEEP_DELIVERIES_SQL, type AlertRuleRow } from "../table";
import { alertsWorkerTick, ChannelFanout, makeAlertsWorkerState } from "../worker";

const DAILY_CAP = 2;
const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const priceRule = (id: string, name: string): AlertRuleRow => {
  const rule: Rule = {
    v: 1,
    kind: "price",
    name,
    for_seconds: 0,
    cooldown_seconds: 0,
    targets: ["inapp"],
    severity: "warn",
    summary: "BTC crossed the level",
    enabled: true,
    condition: { subject: "price:BTC", op: "gte", value: 100 },
  };

  return {
    id,
    subjectType: "device",
    subjectId: "device-1",
    rule,
    signature: `signature-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
};

// Both rules belong to the same subject, so the cap is the sum of their deliveries.
const ENABLED_RULES = [priceRule("rule-1", "One"), priceRule("rule-2", "Two")];

interface TickResult {
  readonly countSince: number[];
  readonly inserts: number;
  readonly published: number;
}

const runTick = async (deliveredForSubject: number): Promise<TickResult> => {
  const countSince: number[] = [];
  let inserts = 0;
  let published = 0;

  const pool = {
    query: (sql: string) => {
      if (sql === INSERT_DELIVERY_SQL) {
        inserts += 1;
        return Promise.resolve({ rows: [{ id: `delivery-${inserts}` }] });
      }
      if (sql === SWEEP_DELIVERIES_SQL) return Promise.resolve({ rows: [] });
      return Promise.reject(new Error(`unexpected query: ${sql}`));
    },
  } as unknown as Pool;

  const repository = Layer.succeed(
    AlertsRepository,
    AlertsRepository.of({
      list: () => Effect.succeed([]),
      listAllEnabled: () => Effect.succeed(ENABLED_RULES),
      findById: () => Effect.succeed(null),
      findBySignature: () => Effect.succeed(null),
      insert: () => Effect.die(new Error("insert is not exercised")),
      setEnabled: () => Effect.succeed(null),
      remove: () => Effect.succeed(false),
      countForSubject: () => Effect.succeed(0),
      countDeliveriesSince: () => Effect.succeed(0),
      countDeliveriesForSubjectSince: (_subjectType, _subjectId, sinceMs) => {
        countSince.push(sinceMs);
        return Effect.succeed(deliveredForSubject);
      },
    }),
  );

  const notifier = Layer.succeed(
    AlertsNotifier,
    AlertsNotifier.of({
      publish: () => {
        published += 1;
      },
      subscribe: () => () => {},
    }),
  );

  const provider = Layer.succeed(
    HyperliquidProvider,
    HyperliquidProvider.of({
      getCandleSnapshot: () => Effect.die(new Error("not exercised")),
      getAllMids: () => Effect.succeed({ BTC: "101" }),
      getAggregatedMarkets: () => Effect.succeed([]),
      getTicker: () => Effect.die(new Error("not exercised")),
      getOrderBook: () => Effect.die(new Error("not exercised")),
      getTradeAnnotation: () => Effect.die(new Error("not exercised")),
    }),
  );

  const config = Layer.succeed(
    AlertsConfig,
    AlertsConfig.of({
      pollIntervalMs: 2_000,
      maxRulesPerDevice: 10,
      dailyCap: DAILY_CAP,
      telegramBotToken: Option.none(),
    }),
  );

  const fanout = Layer.succeed(ChannelFanout, ChannelFanout.of({ deliver: () => Effect.void }));

  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      yield* alertsWorkerTick(makeAlertsWorkerState());
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          repository,
          notifier,
          provider,
          config,
          fanout,
          Layer.succeed(PostgresConnectionPool, pool),
        ),
      ),
      Effect.provide(TestClock.layer()),
    ),
  );

  return { countSince, inserts, published };
};

describe("alerts worker daily cap", () => {
  it("suppresses the next rule once the subject hits the cap, across its rules", async () => {
    const result = await runTick(DAILY_CAP - 1);

    // One query for the subject, then the inserted delivery is counted in memory.
    expect(result.countSince).toEqual([NOW - DAY_MS]);
    expect(result.inserts).toBe(1);
    expect(result.published).toBe(1);
  });

  it("suppresses every rule of a subject that is already at the cap", async () => {
    const result = await runTick(DAILY_CAP);

    expect(result.countSince).toHaveLength(1);
    expect(result.inserts).toBe(0);
    expect(result.published).toBe(0);
  });
});
