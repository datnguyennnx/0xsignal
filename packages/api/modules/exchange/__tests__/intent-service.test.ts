import { describe, expect, it } from "vitest";
import { type Context, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import type { OrderIntentRequest, OrderIntentResultRequest } from "@0xsignal/shared";
import { isIntentExpired } from "../intent";
import { OrderIntentRepo, type OrderIntentRecord } from "../intent-repo";
import { OrderIntentService } from "../intent-service";
import { orderIntentServiceLayer } from "../layer";
import { layerUnlimited as rateLimiterUnlimited } from "../../../integrations/hyperliquid/rate-limit";
import {
  HyperliquidValidationError,
  USER_A,
  makeMockHLClient,
  makeMetaResponse,
  mockInfoInstance,
} from "./helpers";

type OrderIntentRepoShape = Context.Service.Shape<typeof OrderIntentRepo>;

const makeInMemoryRepo = (): { repo: OrderIntentRepoShape; rows: OrderIntentRecord[] } => {
  const rows: OrderIntentRecord[] = [];
  let sequence = 0;

  const find = (id: string, userId: string): OrderIntentRecord | null =>
    rows.find((row) => row.id === id && row.userId === userId) ?? null;

  const replace = (current: OrderIntentRecord, next: OrderIntentRecord): OrderIntentRecord => {
    const index = rows.indexOf(current);
    if (index >= 0) rows[index] = next;
    return next;
  };

  const repo: OrderIntentRepoShape = {
    insert: (intent) =>
      Effect.sync(() => {
        sequence += 1;
        const row: OrderIntentRecord = {
          id: `intent-${sequence}`,
          userId: intent.userId,
          intentHash: intent.intentHash,
          symbol: intent.symbol,
          side: intent.side,
          size: intent.size,
          price: intent.price,
          orderType: intent.orderType,
          reduceOnly: intent.reduceOnly,
          status: "pending",
          txHash: null,
          error: null,
          createdAt: intent.createdAt,
        };
        rows.push(row);
        return row;
      }),

    findById: (id, userId) => Effect.sync(() => find(id, userId)),

    markExpired: (id, userId, nowMillis) =>
      Effect.sync(() => {
        const row = find(id, userId);
        if (row === null || row.status !== "pending") return null;
        if (!isIntentExpired(row.createdAt, nowMillis)) return null;
        const next: OrderIntentRecord = { ...row, status: "expired" };
        return replace(row, next);
      }),

    closePending: (id, userId, close, nowMillis) =>
      Effect.sync(() => {
        const row = find(id, userId);
        if (row === null || row.status !== "pending") return null;
        if (isIntentExpired(row.createdAt, nowMillis)) return null;
        const next: OrderIntentRecord = {
          ...row,
          status: close.status,
          txHash: close.txHash,
          error: close.error,
        };
        return replace(row, next);
      }),

    deleteOlderThan: () => Effect.succeed(0),
  };

  return { repo, rows };
};

const makeLayer = (repo: OrderIntentRepoShape) =>
  orderIntentServiceLayer.pipe(
    Layer.provideMerge(Layer.succeed(OrderIntentRepo, OrderIntentRepo.of(repo))),
    Layer.provideMerge(makeMockHLClient()),
    Layer.provideMerge(rateLimiterUnlimited),
  );

type IntentTestLayer = ReturnType<typeof makeLayer>;

const validIntent: OrderIntentRequest = {
  symbol: "BTC",
  side: "buy",
  size: "0.5",
  price: "100",
  orderType: "limit",
  timeInForce: "GTC",
  reduceOnly: false,
};

const create = (input: OrderIntentRequest) =>
  Effect.gen(function* () {
    const service = yield* OrderIntentService;
    return yield* service.create(input, USER_A);
  });

const recordResult = (intentId: string, result: OrderIntentResultRequest) =>
  Effect.gen(function* () {
    const service = yield* OrderIntentService;
    return yield* service.recordResult(intentId, result, USER_A);
  });

const run = <A, E>(
  effect: Effect.Effect<A, E, OrderIntentService>,
  layer: IntentTestLayer,
): Promise<A> => Effect.runPromise(Effect.provide(effect, Layer.merge(layer, TestClock.layer())));

describe("OrderIntentService", () => {
  it("records a valid intent as pending and returns id + deterministic hash", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();

    const result = await run(create(validIntent), makeLayer(repo));

    expect(result.intentId).toBe("intent-1");
    expect(result.intentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.validated).toEqual({
      assetIndex: 0,
      symbol: "BTC",
      sizeDecimals: 0,
      priceDecimals: 6,
      notionalUsd: 50,
    });
    expect(rows).toHaveLength(1);
    expect(rows.at(0)?.status).toBe("pending");
  });

  it("rejects a zero price on a limit order before persisting", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();

    const error = await Effect.runPromise(
      Effect.provide(
        create({ ...validIntent, price: "0" }).pipe(Effect.flip),
        Layer.merge(makeLayer(repo), TestClock.layer()),
      ),
    );

    expect(error).toBeInstanceOf(HyperliquidValidationError);
    expect(rows).toHaveLength(0);
  });

  it("rejects an unknown symbol before persisting", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();

    const error = await Effect.runPromise(
      Effect.provide(
        create({ ...validIntent, symbol: "NOPE" }).pipe(Effect.flip),
        Layer.merge(makeLayer(repo), TestClock.layer()),
      ),
    );

    expect(error).toBeInstanceOf(HyperliquidValidationError);
    expect(error).toHaveProperty("message", "Symbol not supported on Hyperliquid: NOPE");
    expect(rows).toHaveLength(0);
  });

  it("hashes the same intent identically on resubmission", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();

    const first = await run(create(validIntent), makeLayer(repo));
    const second = await run(create(validIntent), makeLayer(repo));

    expect(second.intentHash).toBe(first.intentHash);
    expect(second.intentId).not.toBe(first.intentId);
    expect(rows).toHaveLength(2);
  });

  it("closes a result exactly once and ignores later conflicting callbacks", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();
    const layer = makeLayer(repo);

    const created = await run(create(validIntent), layer);
    const first = await run(recordResult(created.intentId, { txHash: "0xaaa" }), layer);
    const second = await run(recordResult(created.intentId, { txHash: "0xbbb" }), layer);
    const third = await run(recordResult(created.intentId, { error: "late failure" }), layer);

    expect(first.status).toBe("submitted");
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(rows.at(0)?.status).toBe("submitted");
    expect(rows.at(0)?.txHash).toBe("0xaaa");
  });

  it("reports expired and refuses to close a stale intent as submitted", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    const { repo, rows } = makeInMemoryRepo();
    const layer = makeLayer(repo);

    const created = await run(create(validIntent), layer);
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          yield* TestClock.adjust("3 minutes");
          const service = yield* OrderIntentService;
          return yield* service.recordResult(created.intentId, { txHash: "0xaaa" }, USER_A);
        }),
        Layer.merge(layer, TestClock.layer()),
      ),
    );

    expect(result.status).toBe("expired");
    expect(result.txHash).toBeNull();
    expect(rows.at(0)?.status).toBe("expired");
  });
});
