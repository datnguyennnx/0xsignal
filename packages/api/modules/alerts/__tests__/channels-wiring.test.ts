import { describe, expect, it } from "vitest";
import { Effect, Layer, Option } from "effect";
import type { Pool } from "pg";
import { PostgresConnectionPool } from "@0xsignal/auth";
import type { Rule } from "@0xsignal/shared/alerts";
import { AlertsConfig } from "../config";
import { ChannelsService, ChannelsServiceWithInfra } from "../channels/service";
import { AlertsNotifier } from "../notifier";
import { AlertsRepository } from "../repository";
import { INSERT_DELIVERY_SQL, SWEEP_DELIVERIES_SQL, type AlertRuleRow } from "../table";
import { HyperliquidProvider } from "../../../integrations/hyperliquid/data-sources/types";
import {
  alertsWorkerTick,
  ChannelFanout,
  ChannelFanoutWithInfra,
  makeAlertsWorkerState,
} from "../worker";

const config = AlertsConfig.of({
  pollIntervalMs: 2_000,
  maxRulesPerDevice: 10,
  dailyCap: 12,
  telegramBotToken: Option.none(),
});

const emptyPool = {
  query: () => Promise.resolve({ rows: [] }),
} as unknown as Pool;

const tickPool = {
  query: (sql: string) => {
    if (sql === INSERT_DELIVERY_SQL) return Promise.resolve({ rows: [{ id: "delivery-1" }] });
    if (sql === SWEEP_DELIVERIES_SQL) return Promise.resolve({ rows: [] });
    return Promise.reject(new Error(`unexpected query: ${sql}`));
  },
} as unknown as Pool;

const priceRule: AlertRuleRow = {
  id: "rule-1",
  subjectType: "device",
  subjectId: "device-1",
  signature: "signature-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  rule: {
    v: 1,
    kind: "price",
    name: "One",
    for_seconds: 0,
    cooldown_seconds: 0,
    targets: ["inapp"],
    severity: "warn",
    summary: "BTC crossed the level",
    enabled: true,
    condition: { subject: "price:BTC", op: "gte", value: 100 },
  } satisfies Rule,
};

const repositoryFor = (rules: AlertRuleRow[]) =>
  Layer.succeed(
    AlertsRepository,
    AlertsRepository.of({
      list: () => Effect.succeed([]),
      listAllEnabled: () => Effect.succeed(rules),
      findById: () => Effect.succeed(null),
      findBySignature: () => Effect.succeed(null),
      insert: () => Effect.die(new Error("insert is not exercised")),
      setEnabled: () => Effect.succeed(null),
      remove: () => Effect.succeed(false),
      countForSubject: () => Effect.succeed(0),
      countDeliveriesSince: () => Effect.succeed(0),
      countDeliveriesForSubjectSince: () => Effect.succeed(0),
    }),
  );

const notifier = Layer.succeed(
  AlertsNotifier,
  AlertsNotifier.of({
    publish: () => {},
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

const common = [notifier, provider, Layer.succeed(AlertsConfig, config)] as const;

describe("alerts channel wiring", () => {
  it("resolves ChannelsService from the merged layers", async () => {
    const env = Layer.mergeAll(
      ChannelFanoutWithInfra.pipe(Layer.provide(Layer.succeed(PostgresConnectionPool, emptyPool))),
      ChannelsServiceWithInfra.pipe(
        Layer.provide(Layer.succeed(PostgresConnectionPool, emptyPool)),
      ),
      repositoryFor([]),
      ...common,
    );

    const resolved = await Effect.runPromise(
      Effect.gen(function* () {
        const channels = Option.getOrUndefined(yield* Effect.serviceOption(ChannelsService));
        return channels !== undefined && typeof channels.forSubjects === "function";
      }).pipe(Effect.provide(env)),
    );

    expect(resolved).toBe(true);
  });

  it("uses one injected fan-out instance for every worker tick", async () => {
    let deliveries = 0;
    const fanout = ChannelFanout.of({
      deliver: () => {
        deliveries += 1;
        return Effect.void;
      },
    });

    const env = Layer.mergeAll(
      Layer.succeed(ChannelFanout, fanout),
      repositoryFor([priceRule]),
      Layer.succeed(PostgresConnectionPool, tickPool),
      ...common,
    );

    const sameInstance = await Effect.runPromise(
      Effect.gen(function* () {
        const before = yield* ChannelFanout;
        yield* alertsWorkerTick(makeAlertsWorkerState());
        yield* alertsWorkerTick(makeAlertsWorkerState());
        yield* Effect.yieldNow;
        const after = yield* ChannelFanout;
        return { same: before === after, deliveries };
      }).pipe(Effect.provide(env)),
    );

    expect(sameInstance.same).toBe(true);
    expect(sameInstance.deliveries).toBe(2);
  });
});
