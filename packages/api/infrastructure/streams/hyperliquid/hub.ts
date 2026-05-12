import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
import { normalizeSymbol } from "../../data-sources/hyperliquid/symbol";
import { HyperliquidProvider } from "../../data-sources/hyperliquid/types";
import type { AggregatedTradeAsset } from "../../data-sources/hyperliquid/types";
import { Data, Effect } from "effect";
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
  restarting: boolean;
  restartTimer?: ReturnType<typeof setTimeout>;
  firstMarketBroadcastLogged: boolean;
  retryCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class HyperliquidMarketStreamHub {
  private readonly transport = new WebSocketTransport({
    resubscribe: true,
  });

  private readonly subscriptionClient = new SubscriptionClient({
    transport: this.transport,
  });

  private readonly buckets = new Map<string, Bucket>();

  private connectionSeq = 0;

  private shuttingDown = false;

  constructor(private readonly provider?: typeof HyperliquidProvider.Service) {}

  createConnectionData(subscription: MarketWsSubscription): MarketWsConnectionData {
    this.connectionSeq += 1;

    // normalizeSymbol handles perp ("BTCUSDT" → "BTC"), builder perp ("XYZ:YEETI"), spot ("PURR/USDC")
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
      timestamp: Date.now(),
    });

    void this.ensureUpstream(bucket.key);
  }

  handleClose(ws: ServerWebSocket<MarketWsConnectionData>) {
    this.detach(ws);
  }

  handleMessage(ws: ServerWebSocket<MarketWsConnectionData>, raw: string | Buffer | Uint8Array) {
    const payload = this.toText(raw).trim();
    if (payload === "ping") {
      this.send(ws, { type: "pong", timestamp: Date.now() });
      return;
    }

    if (payload.length > 0) {
      this.send(ws, {
        type: "error",
        code: "unsupported_message",
        message: "Only ping messages are supported on this endpoint.",
        timestamp: Date.now(),
      });
    }
  }

  private async ensureUpstream(key: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.upstream || bucket.clients.size === 0 || this.shuttingDown) {
      return;
    }

    try {
      bucket.upstream = await this.subscribeUpstream(bucket);
      // Reset retry count on success
      bucket.retryCount = 0;
      marketWsLog("upstream_subscribe_success", {
        bucketKey: bucket.key,
        channel: bucket.subscription.channel,
        clientsInBucket: bucket.clients.size,
      });
      this.broadcast(bucket, {
        type: "ready",
        subscription: bucket.subscription,
        timestamp: Date.now(),
      });
      bucket.upstream.failureSignal.addEventListener(
        "abort",
        () => {
          marketWsLog(
            "upstream_failure_signal",
            {
              bucketKey: bucket.key,
              channel: bucket.subscription.channel,
            },
            "warn"
          );
          void this.restartBucket(bucket.key, "upstream_subscription_failed");
        },
        { once: true }
      );
    } catch (error) {
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
        timestamp: Date.now(),
      });
      void this.restartBucket(bucket.key, "upstream_subscribe_failed");
    }
  }

  private async restartBucket(key: string, reason: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.restarting || bucket.clients.size === 0) {
      return;
    }

    // Limit retries to prevent infinite restart cascade and API flooding
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
        timestamp: Date.now(),
      });
      // Bucket cleaned up on detach when no clients remain
      for (const client of [...bucket.clients]) {
        this.detach(client);
      }
      return;
    }

    bucket.restarting = true;
    bucket.retryCount++;

    if (bucket.upstream) {
      try {
        await bucket.upstream.unsubscribe();
      } catch {
        // Ignore unsubscribe errors during restart.
      } finally {
        bucket.upstream = undefined;
      }
    }

    this.broadcast(bucket, {
      type: "reconnecting",
      reason,
      timestamp: Date.now(),
    });

    bucket.restartTimer = setTimeout(() => {
      const current = this.buckets.get(key);
      if (!current) {
        return;
      }
      current.restartTimer = undefined;
      current.restarting = false;
      void this.ensureUpstream(key);
    }, 500);
  }

  private async subscribeUpstream(bucket: Bucket): Promise<ISubscription> {
    const { subscription } = bucket;

    let internalSymbol = subscription.symbol;
    // Validate against unified aggregated markets (same source as REST /markets).
    const subSymbol = subscription.symbol;
    if (this.provider && subSymbol) {
      try {
        const markets = await Effect.runPromise(this.provider.getAggregatedMarkets());
        const subUpper = subSymbol.toUpperCase();
        const asset: AggregatedTradeAsset | undefined = markets.find(
          (m) => m.rawCoin === subSymbol || m.rawCoin.toUpperCase() === subUpper
        );

        if (!asset) {
          throw new WebSocketSubscribeError({
            message: `Cannot subscribe to WebSocket for "${subSymbol}": not found in any market universe (perp, spot, or outcome).`,
            symbol: subSymbol,
          });
        }

        // Only perp assets support real-time subscriptions; spot assets lack WS feeds.
        // Subscribing an unsupported coin can close the ENTIRE WebSocket connection.
        if (asset.marketType !== "perp") {
          marketWsLog(
            "symbol_validation_failed",
            {
              symbol: subSymbol,
              marketType: asset.marketType,
              channel: subscription.channel,
            },
            "warn"
          );
          throw new WebSocketSubscribeError({
            message: `Cannot subscribe to WebSocket for "${subSymbol}": market type is "${asset.marketType}". Only perpetual (perp) assets support real-time candle, order book, and trades subscriptions.`,
            symbol: subSymbol,
          });
        }

        // Use rawCoin as internal symbol (e.g., "BTC" for main, "xyz:YEETI" for builder)
        internalSymbol = asset.rawCoin;
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
    if (bucket.restartTimer) {
      clearTimeout(bucket.restartTimer);
      bucket.restartTimer = undefined;
    }
    if (bucket.upstream) {
      void bucket.upstream.unsubscribe().catch((err) => {
        marketWsLog("unsubscribe_error", { bucketKey: bucket.key, error: String(err) }, "warn");
      });
    }
  }

  shutdown() {
    this.shuttingDown = true;
    for (const bucket of this.buckets.values()) {
      if (bucket.restartTimer) {
        clearTimeout(bucket.restartTimer);
        bucket.restartTimer = undefined;
      }
      if (bucket.upstream) {
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
    for (const client of bucket.clients) {
      try {
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
