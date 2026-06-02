import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";
import { HyperliquidProvider } from "../../data-sources/hyperliquid/types";
import type { HyperliquidAggregatedAsset } from "../../data-sources/hyperliquid/types";
import { Clock, Data, Effect, Fiber } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import {
  normalizeAllMidsData,
  normalizeCandleData,
  normalizeL2BookData,
  normalizeTradesData,
} from "./normalizers";

export type MarketWsConnectionData = {
  readonly id: string;
  readonly bucketKey: string;
  readonly subscription: MarketWsSubscription;
};

export class WebSocketSubscribeError extends Data.TaggedError("WebSocketSubscribeError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

const MAX_RESTART_RETRIES = 3;

type Bucket = {
  readonly key: string;
  readonly subscription: MarketWsSubscription;
  readonly clients: Set<ServerWebSocket<MarketWsConnectionData>>;
  upstream?: ISubscription;
  subscribing?: Promise<void>; // Promise-based mutex lock for ensureUpstream
  /** Cleanup handle for the old subscription's failureSignal abort listener */
  failureSignalAbortHandler?: () => void;
  restarting: boolean;
  firstMarketBroadcastLogged: boolean;
  retryCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Extend ServerWebSocket with the runtime backpressure property not exposed in bun types
interface ServerWebSocketWithBackpressure<T = undefined> extends ServerWebSocket<T> {
  readonly backpressure: number;
}

export class HyperliquidMarketStreamHub {
  // Event-driven WebSocket hub
  private readonly transport = new WebSocketTransport({
    resubscribe: true,
  });

  private readonly subscriptionClient = new SubscriptionClient({
    transport: this.transport,
  });

  private readonly buckets = new Map<string, Bucket>();

  private runtime?: ManagedRuntime<any, any>;

  private connectionSeq = 0;

  private shuttingDown = false;

  private aggregatedMarketsPromise?: Promise<readonly HyperliquidAggregatedAsset[]>;

  private readonly restartFibers = new Set<Fiber.Fiber<unknown, unknown>>();

  constructor(private readonly provider?: typeof HyperliquidProvider.Service) {}

  setRuntime(runtime: ManagedRuntime<any, any>): void {
    this.runtime = runtime;
    // Pre-fetch aggregated markets once at startup; resolves from provider's cache
    if (this.provider) {
      this.aggregatedMarketsPromise = runtime.runPromise(this.provider.getAggregatedMarkets());
    }
  }

  createConnectionData(subscription: MarketWsSubscription): MarketWsConnectionData {
    this.connectionSeq += 1;

    // Normalize symbol to resolve API-level identifier
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

    this.send(ws, {
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
    const payload = this.toText(raw).trim();
    if (payload === "ping") {
      this.send(ws, { type: "pong", timestamp: Effect.runSync(Clock.currentTimeMillis) });
      return;
    }

    if (payload.length > 0) {
      this.send(ws, {
        type: "error",
        code: "unsupported_message",
        message: "Only ping messages are supported on this endpoint.",
        timestamp: Effect.runSync(Clock.currentTimeMillis),
      });
    }
  }

  private async ensureUpstream(key: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.upstream || bucket.clients.size === 0 || this.shuttingDown) {
      return;
    }

    // Deduplicate concurrent subscribe calls
    if (bucket.subscribing) {
      try {
        await bucket.subscribing;
      } catch {
        /* ignore */
      }
      return;
    }

    // Mutex: single subscription per bucket
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
          this.broadcast(bucket, {
            type: "ready",
            subscription: bucket.subscription,
            timestamp: Effect.runSync(Clock.currentTimeMillis),
          });
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
          this.broadcast(bucket, {
            type: "error",
            code: "upstream_subscribe_failed",
            message: error instanceof Error ? error.message : String(error),
            timestamp: Effect.runSync(Clock.currentTimeMillis),
          });
          void this.restartBucket(bucket.key, "upstream_subscribe_failed");
        }
      )
      .finally(() => {
        bucket.subscribing = undefined;
      });

    bucket.subscribing = subscribePromise;
    await subscribePromise;
  }

  private async restartBucket(key: string, reason: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.restarting || bucket.clients.size === 0) {
      return;
    }

    // Bounded retries to prevent API flooding
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
      this.broadcast(bucket, {
        type: "error",
        code: "max_retries_exceeded",
        message: `Max retries (${MAX_RESTART_RETRIES}) exceeded for ${bucket.key}`,
        timestamp: Effect.runSync(Clock.currentTimeMillis),
      });
      for (const client of [...bucket.clients]) {
        this.detach(client);
      }
      return;
    }

    bucket.restarting = true;
    bucket.retryCount++;

    if (bucket.upstream) {
      // Remove old failure signal listener to prevent stale restarts
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
      } finally {
        bucket.upstream = undefined;
      }
    }

    this.broadcast(bucket, {
      type: "reconnecting",
      reason,
      timestamp: Effect.runSync(Clock.currentTimeMillis),
    });

    if (this.runtime) {
      const fiberPromise = this.runtime.runPromise(
        Effect.forkDetach(
          Effect.sleep("500 millis").pipe(
            Effect.flatMap(() => {
              const current = this.buckets.get(key);
              if (!current) {
                return Effect.void;
              }
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

  private async subscribeUpstream(bucket: Bucket): Promise<ISubscription> {
    const { subscription } = bucket;

    let internalSymbol = subscription.symbol;
    // Validate against remote market universe
    const subSymbol = subscription.symbol;
    if (this.aggregatedMarketsPromise && subSymbol) {
      try {
        const markets = await this.aggregatedMarketsPromise;
        if (markets) {
          const subUpper = subSymbol.toUpperCase();
          const asset: HyperliquidAggregatedAsset | undefined = markets.find(
            (m) => m.rawCoin === subSymbol || m.rawCoin.toUpperCase() === subUpper
          );

          if (!asset) {
            throw new WebSocketSubscribeError({
              message: `Cannot subscribe to WebSocket for "${subSymbol}": not found in any market universe (perp, spot, or outcome).`,
              symbol: subSymbol,
            });
          }

          // Resolve coin to API-level identifier (perp rawCoin / spot @index)
          internalSymbol = asset.marketType === "spot" ? asset.name : asset.rawCoin;
        }
      } catch (error) {
        marketWsLog(
          "symbol_resolution_failed",
          {
            symbol: subSymbol,
            error: error instanceof Error ? error.message : String(error),
          },
          "warn"
        );
        throw error;
      }
    }

    switch (subscription.channel) {
      case "candle":
        return this.subscriptionClient.candle(
          {
            coin: internalSymbol!,
            interval: subscription.interval!,
          },
          (event) => {
            this.broadcast(bucket, {
              type: "market",
              channel: "candle",
              interval: subscription.interval,
              data: normalizeCandleData(event),
            });
          }
        );

      case "l2Book":
        return this.subscriptionClient.l2Book(
          {
            coin: internalSymbol!,
            nSigFigs: subscription.nSigFigs,
          },
          (event) => {
            const normalized = normalizeL2BookData(event);
            const levels = normalized.levels as unknown[];
            const maxDepth = (subscription as any).depth ?? 30;
            const sliced = {
              levels: [
                (levels?.[0] as unknown[])?.slice(0, maxDepth) ?? [],
                (levels?.[1] as unknown[])?.slice(0, maxDepth) ?? [],
              ],
            };
            this.broadcast(bucket, {
              type: "market",
              channel: "l2Book",
              nSigFigs: subscription.nSigFigs,
              data: sliced,
            });
          }
        );

      case "trades":
        return this.subscriptionClient.trades(
          {
            coin: internalSymbol!,
          },
          (event) => {
            this.broadcast(bucket, {
              type: "market",
              channel: "trades",
              data: normalizeTradesData(event),
            });
          }
        );

      case "allMids":
        return subscription.dex
          ? this.subscriptionClient.allMids({ dex: subscription.dex }, (event) => {
              this.broadcast(bucket, {
                type: "market",
                channel: "allMids",
                data: normalizeAllMidsData(event),
              });
            })
          : this.subscriptionClient.allMids((event) => {
              this.broadcast(bucket, {
                type: "market",
                channel: "allMids",
                data: normalizeAllMidsData(event),
              });
            });
    }
  }

  private detach(ws: ServerWebSocket<MarketWsConnectionData>) {
    const bucket = this.buckets.get(ws.data.bucketKey);
    if (!bucket) {
      return;
    }

    bucket.clients.delete(ws);
    if (bucket.clients.size > 0) {
      return;
    }

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

    // Interrupt all tracked restart fibers to prevent post-shutdown effects
    for (const fiber of this.restartFibers) {
      fiber.interruptUnsafe();
    }
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

  private broadcast(bucket: Bucket, payload: unknown) {
    if (!bucket.firstMarketBroadcastLogged && isRecord(payload) && payload.type === "market") {
      bucket.firstMarketBroadcastLogged = true;
      marketWsLog("first_market_broadcast", {
        bucketKey: bucket.key,
        channel: bucket.subscription.channel,
        clientsInBucket: bucket.clients.size,
      });
    }

    const encoded = JSON.stringify(payload);
    const MAX_BACKPRESSURE_BYTES = 1024 * 1024; // 1MB threshold

    for (const client of bucket.clients) {
      try {
        // Disconnect slow clients to prevent server memory bloat
        const backpressure =
          (client as unknown as ServerWebSocketWithBackpressure).backpressure ?? 0;
        if (backpressure > MAX_BACKPRESSURE_BYTES) {
          marketWsLog(
            "backpressure_exceeded",
            {
              connectionId: client.data.id,
              bucketKey: bucket.key,
              backpressure,
            },
            "warn"
          );
          client.close(1011, "High backpressure - slow client");
          this.detach(client);
          continue;
        }

        client.send(encoded);
      } catch {
        this.detach(client);
      }
    }
  }

  private send(ws: ServerWebSocket<MarketWsConnectionData>, payload: unknown) {
    ws.send(JSON.stringify(payload));
  }

  private toText(raw: string | Buffer | Uint8Array): string {
    if (typeof raw === "string") {
      return raw;
    }
    return Buffer.from(raw).toString("utf8");
  }
}
