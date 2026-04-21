import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { ServerWebSocket } from "bun";
import type { MarketWsSubscription } from "../../../schemas/market-data/ws";
import { marketWsLog } from "./logging";
import { buildMarketWsBucketKey } from "./bucket-key";
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

type Bucket = {
  readonly key: string;
  readonly subscription: MarketWsSubscription;
  readonly clients: Set<ServerWebSocket<MarketWsConnectionData>>;
  upstream?: ISubscription;
  restarting: boolean;
  restartTimer?: ReturnType<typeof setTimeout>;
  firstMarketBroadcastLogged: boolean;
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

  createConnectionData(subscription: MarketWsSubscription): MarketWsConnectionData {
    this.connectionSeq += 1;
    return {
      id: String(this.connectionSeq),
      bucketKey: buildMarketWsBucketKey(subscription),
      subscription,
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

    bucket.restarting = true;

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

    switch (subscription.channel) {
      case "candle":
        return this.subscriptionClient.candle(
          {
            coin: subscription.symbol!,
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
            coin: subscription.symbol!,
            nSigFigs: subscription.nSigFigs,
          },
          (event) => {
            this.broadcast(bucket, {
              type: "market",
              channel: "l2Book",
              nSigFigs: subscription.nSigFigs,
              data: normalizeL2BookData(event),
            });
          }
        );

      case "trades":
        return this.subscriptionClient.trades(
          {
            coin: subscription.symbol!,
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
      void bucket.upstream.unsubscribe().catch(() => {
        // Ignore unsubscribe errors during cleanup.
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
        void bucket.upstream.unsubscribe().catch(() => {
          // Ignore unsubscribe errors during shutdown.
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
