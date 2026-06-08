import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";
import { HyperliquidProvider } from "../../data-sources/hyperliquid/types";
import type { HyperliquidAggregatedAsset } from "../../data-sources/hyperliquid/types";
import { Clock, Effect, Fiber } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import { subscribeUpstream } from "./hub-subscription";
import { broadcast, send, toText } from "./hub-broadcast";
import { type MarketWsConnectionData, WebSocketSubscribeError, type Bucket } from "./hub-types";

const MAX_RESTART_RETRIES = 3;

export type { MarketWsConnectionData };
export { WebSocketSubscribeError };

export class HyperliquidMarketStreamHub {
  private readonly transport = new WebSocketTransport({ resubscribe: true });
  private readonly subscriptionClient = new SubscriptionClient({ transport: this.transport });
  private readonly buckets = new Map<string, Bucket>();
  private runtime?: ManagedRuntime<any, any>;
  private connectionSeq = 0;
  private shuttingDown = false;
  private aggregatedMarketsPromise?: Promise<readonly HyperliquidAggregatedAsset[]>;
  private readonly restartFibers = new Set<Fiber.Fiber<unknown, unknown>>();

  constructor(private readonly provider?: typeof HyperliquidProvider.Service) {}

  setRuntime(runtime: ManagedRuntime<any, any>): void {
    this.runtime = runtime;
    if (this.provider) {
      this.aggregatedMarketsPromise = runtime.runPromise(this.provider.getAggregatedMarkets());
    }
  }

  createConnectionData(subscription: MarketWsSubscription): MarketWsConnectionData {
    this.connectionSeq += 1;
    const normalizedSubscription = { ...subscription };
    if (normalizedSubscription.symbol) {
      normalizedSubscription.symbol = normalizeSymbol(normalizedSubscription.symbol);
    }
    return {
      id: String(this.connectionSeq),
      bucketKey: buildMarketWsBucketKey(normalizedSubscription),
      subscription: normalizedSubscription,
    };
  }

  handleOpen(ws: ServerWebSocket<MarketWsConnectionData>) {
    const existing = this.buckets.get(ws.data.bucketKey);
    const bucket: Bucket = existing ?? {
      key: ws.data.bucketKey,
      subscription: ws.data.subscription,
      clients: new Set(),
      restarting: false,
      firstMarketBroadcastLogged: false,
      retryCount: 0,
    };

    bucket.clients.add(ws);
    this.buckets.set(bucket.key, bucket);

    marketWsLog("ws_open", {
      connectionId: ws.data.id,
      bucketKey: bucket.key,
      channel: bucket.subscription.channel,
      clientsInBucket: bucket.clients.size,
    });

    send(ws, {
      type: "ready",
      subscription: bucket.subscription,
      connectionId: ws.data.id,
      timestamp: Effect.runSync(Clock.currentTimeMillis),
    });

    this.ensureUpstream(bucket.key).catch((err) => {
      marketWsLog(
        "ensure_upstream_error",
        {
          bucketKey: bucket.key,
          error: err instanceof Error ? err.message : String(err),
        },
        "error"
      );
    });
  }

  handleClose(ws: ServerWebSocket<MarketWsConnectionData>) {
    this.detach(ws);
  }

  handleMessage(ws: ServerWebSocket<MarketWsConnectionData>, raw: string | Buffer | Uint8Array) {
    const payload = toText(raw).trim();
    if (payload === "ping") {
      send(ws, { type: "pong", timestamp: Effect.runSync(Clock.currentTimeMillis) });
      return;
    }
    if (payload.length > 0) {
      send(ws, {
        type: "error",
        code: "unsupported_message",
        message: "Only ping messages are supported on this endpoint.",
        timestamp: Effect.runSync(Clock.currentTimeMillis),
      });
    }
  }

  private async ensureUpstream(key: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.upstream || bucket.clients.size === 0 || this.shuttingDown) return;

    if (bucket.subscribing) {
      try {
        await bucket.subscribing;
      } catch {
        /* ignore */
      }
      return;
    }

    const subscribePromise = this.subscribeUpstream(bucket)
      .then(
        (sub) => {
          bucket.upstream = sub;
          bucket.retryCount = 0;
          marketWsLog("upstream_subscribe_success", {
            bucketKey: bucket.key,
            channel: bucket.subscription.channel,
            clientsInBucket: bucket.clients.size,
          });
          broadcast(
            bucket,
            {
              type: "ready",
              subscription: bucket.subscription,
              timestamp: Effect.runSync(Clock.currentTimeMillis),
            },
            (ws) => this.detach(ws)
          );
          const abortHandler = () => {
            marketWsLog(
              "upstream_failure_signal",
              {
                bucketKey: bucket.key,
                channel: bucket.subscription.channel,
              },
              "warn"
            );
            bucket.failureSignalAbortHandler = undefined;
            void this.restartBucket(bucket.key, "upstream_subscription_failed");
          };
          sub.failureSignal.addEventListener("abort", abortHandler, { once: true });
          bucket.failureSignalAbortHandler = abortHandler;
        },
        (error) => {
          marketWsLog(
            "upstream_subscribe_failed",
            {
              bucketKey: bucket.key,
              channel: bucket.subscription.channel,
              error: error instanceof Error ? error.message : String(error),
            },
            "error"
          );
          broadcast(
            bucket,
            {
              type: "error",
              code: "upstream_subscribe_failed",
              message: error instanceof Error ? error.message : String(error),
              timestamp: Effect.runSync(Clock.currentTimeMillis),
            },
            (ws) => this.detach(ws)
          );
          void this.restartBucket(bucket.key, "upstream_subscribe_failed");
        }
      )
      .finally(() => {
        bucket.subscribing = undefined;
      });

    bucket.subscribing = subscribePromise;
    await subscribePromise;
  }

  private async subscribeUpstream(bucket: Bucket): Promise<ISubscription> {
    return subscribeUpstream(bucket, this.subscriptionClient, this.aggregatedMarketsPromise, (ws) =>
      this.detach(ws)
    );
  }

  private async restartBucket(key: string, reason: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.restarting || bucket.clients.size === 0) return;

    if (bucket.retryCount >= MAX_RESTART_RETRIES) {
      marketWsLog(
        "upstream_max_retries_exceeded",
        {
          bucketKey: bucket.key,
          channel: bucket.subscription.channel,
          retryCount: bucket.retryCount,
        },
        "error"
      );
      broadcast(
        bucket,
        {
          type: "error",
          code: "max_retries_exceeded",
          message: `Max retries (${MAX_RESTART_RETRIES}) exceeded for ${bucket.key}`,
          timestamp: Effect.runSync(Clock.currentTimeMillis),
        },
        (ws) => this.detach(ws)
      );
      for (const client of [...bucket.clients]) this.detach(client);
      return;
    }

    bucket.restarting = true;
    bucket.retryCount++;

    if (bucket.upstream) {
      if (bucket.failureSignalAbortHandler) {
        bucket.upstream.failureSignal.removeEventListener(
          "abort",
          bucket.failureSignalAbortHandler
        );
        bucket.failureSignalAbortHandler = undefined;
      }
      try {
        await bucket.upstream.unsubscribe();
      } catch {
        /* ignore */
      }
      bucket.upstream = undefined;
    }

    broadcast(
      bucket,
      {
        type: "reconnecting",
        reason,
        timestamp: Effect.runSync(Clock.currentTimeMillis),
      },
      (ws) => this.detach(ws)
    );

    if (this.runtime) {
      const fiberPromise = this.runtime.runPromise(
        Effect.forkDetach(
          Effect.sleep("500 millis").pipe(
            Effect.flatMap(() => {
              const current = this.buckets.get(key);
              if (!current) return Effect.void;
              current.restarting = false;
              return Effect.sync(() => this.ensureUpstream(key));
            })
          )
        )
      );

      fiberPromise
        .then((fiber) => {
          this.restartFibers.add(fiber);
          fiber.addObserver(() => {
            this.restartFibers.delete(fiber);
          });
        })
        .catch((err) => {
          marketWsLog(
            "restart_error",
            {
              bucketKey: key,
              error: err instanceof Error ? err.message : String(err),
            },
            "error"
          );
        });
    }
  }

  private detach(ws: ServerWebSocket<MarketWsConnectionData>) {
    const bucket = this.buckets.get(ws.data.bucketKey);
    if (!bucket) return;
    bucket.clients.delete(ws);
    if (bucket.clients.size > 0) return;

    this.buckets.delete(bucket.key);
    if (bucket.upstream) {
      if (bucket.failureSignalAbortHandler) {
        bucket.upstream.failureSignal.removeEventListener(
          "abort",
          bucket.failureSignalAbortHandler
        );
        bucket.failureSignalAbortHandler = undefined;
      }
      void bucket.upstream.unsubscribe().catch((err) => {
        marketWsLog("unsubscribe_error", { bucketKey: bucket.key, error: String(err) }, "warn");
      });
    }
  }

  shutdown() {
    this.shuttingDown = true;
    for (const fiber of this.restartFibers) fiber.interruptUnsafe();
    this.restartFibers.clear();
    for (const bucket of this.buckets.values()) {
      if (bucket.upstream) {
        if (bucket.failureSignalAbortHandler) {
          bucket.upstream.failureSignal.removeEventListener(
            "abort",
            bucket.failureSignalAbortHandler
          );
          bucket.failureSignalAbortHandler = undefined;
        }
        void bucket.upstream.unsubscribe().catch((err) => {
          marketWsLog("unsubscribe_error", { bucketKey: bucket.key, error: String(err) }, "warn");
        });
        bucket.upstream = undefined;
      }
      bucket.restarting = false;
      bucket.clients.clear();
    }
    this.buckets.clear();
  }
}
