import { Clock, Context, Effect } from "effect";
import type {
  OrderIntentRequest,
  OrderIntentResponse,
  OrderIntentResultRequest,
  OrderIntentResultResponse,
  OrderType,
} from "@0xsignal/shared";
import { HyperliquidClient } from "../../integrations/hyperliquid/data-sources/hyperliquid-client";
import { HyperliquidRateLimiter } from "../../integrations/hyperliquid/rate-limit";
import {
  HyperliquidInternalError,
  HyperliquidValidationError,
  NotFoundError,
} from "../../shared/errors";
import { hashIntent, isIntentExpired } from "./intent";
import {
  OrderIntentRepo,
  OrderIntentRepoError,
  type OrderIntentClose,
  type OrderIntentRecord,
} from "./intent-repo";
import { getCachedMeta, makeMetaCache } from "./meta-cache";
import { buildCoinToAsset, validateOrderInput } from "./order-validation";

type OrderIntentError =
  | HyperliquidValidationError
  | HyperliquidInternalError
  | OrderIntentRepoError
  | NotFoundError;

export class OrderIntentService extends Context.Service<
  OrderIntentService,
  {
    readonly create: (
      input: OrderIntentRequest,
      userId: string,
    ) => Effect.Effect<OrderIntentResponse, OrderIntentError>;

    readonly recordResult: (
      id: string,
      result: OrderIntentResultRequest,
      userId: string,
    ) => Effect.Effect<OrderIntentResultResponse, OrderIntentError>;
  }
>()("OrderIntentService") {}

const toResponse = (id: string, row: OrderIntentRecord): OrderIntentResultResponse => ({
  intentId: id,
  status: row.status,
  txHash: row.txHash,
  error: row.error,
});

const closeOutcome = (result: OrderIntentResultRequest): OrderIntentClose =>
  "txHash" in result
    ? { status: "submitted", txHash: result.txHash, error: null }
    : { status: "rejected", txHash: null, error: result.error };

const notFound = (): NotFoundError => new NotFoundError({ message: "Order intent not found" });

export const makeOrderIntentService = () =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const limiter = yield* HyperliquidRateLimiter;
    const repo = yield* OrderIntentRepo;
    const metaCache = yield* makeMetaCache(info, limiter);

    return OrderIntentService.of({
      create: (input, userId) =>
        Effect.gen(function* () {
          const meta = yield* getCachedMeta(metaCache);
          const coinToAsset = buildCoinToAsset(meta);
          const reduceOnly = input.reduceOnly ?? false;
          const orderType: OrderType =
            input.orderType === "market"
              ? { kind: "limit", timeInForce: "FrontendMarket" }
              : { kind: "limit", timeInForce: input.timeInForce ?? "GTC" };

          const validated = yield* validateOrderInput(
            {
              symbol: input.symbol,
              side: input.side,
              quantity: input.size,
              price: input.price ?? "0",
              reduceOnly,
              orderType,
            },
            coinToAsset,
          );

          const now = yield* Clock.currentTimeMillis;
          const intentHash = hashIntent(input);
          const row = yield* repo.insert({
            userId,
            intentHash,
            symbol: input.symbol,
            side: input.side,
            size: input.size,
            price: input.price,
            orderType: input.orderType,
            timeInForce: input.timeInForce ?? null,
            reduceOnly,
            slippageBps: input.slippageBps ?? null,
            leverage: input.leverage ?? null,
            createdAt: new Date(now).toISOString(),
          });

          const universeEntry = meta.universe[validated.assetIndex];
          const sizeDecimals = universeEntry?.szDecimals ?? 0;
          return {
            intentId: row.id,
            intentHash,
            validated: {
              assetIndex: validated.assetIndex,
              symbol: input.symbol,
              sizeDecimals,
              priceDecimals: Math.max(0, 6 - sizeDecimals),
              notionalUsd: Number(validated.size) * Number(validated.price),
            },
          };
        }),

      recordResult: (id, result, userId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const existing = yield* repo.findById(id, userId);
          if (existing === null) return yield* Effect.fail(notFound());

          if (existing.status === "pending" && isIntentExpired(existing.createdAt, now)) {
            const expired = yield* repo.markExpired(id, userId, now);
            return toResponse(id, expired ?? { ...existing, status: "expired" });
          }

          if (existing.status !== "pending") return toResponse(id, existing);

          const closed = yield* repo.closePending(id, userId, closeOutcome(result), now);
          if (closed !== null) return toResponse(id, closed);

          // A concurrent close or expiry won the guarded update; report what
          // is stored rather than overwriting it.
          const current = yield* repo.findById(id, userId);
          if (current === null) return yield* Effect.fail(notFound());
          return toResponse(id, current);
        }),
    });
  });
