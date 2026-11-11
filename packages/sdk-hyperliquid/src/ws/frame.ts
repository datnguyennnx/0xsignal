/**
 * @hyperliquid-api wss://api.hyperliquid.xyz/ws (frame decode)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket.md
 */

import { TransportError } from "../core/errors";
import { cast } from "../core/parse";
import { CHANNEL_OF } from "./channels";
import type { L2BookSubscription, Subscription } from "./types";

const decoder = new TextDecoder();

export function frameText(payload: unknown): Promise<string> {
  if (typeof payload === "string") return Promise.resolve(payload);
  if (payload instanceof ArrayBuffer) return Promise.resolve(decoder.decode(payload));
  if (ArrayBuffer.isView(payload)) return Promise.resolve(decoder.decode(payload));
  if (typeof Blob !== "undefined" && payload instanceof Blob) return payload.text();
  throw new TransportError(new TypeError(`unsupported websocket frame: ${typeof payload}`));
}

export function hasSnapshotFlag(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = cast<Record<string, unknown>>(data, "message.data");
  return record["isSnapshot"] === true;
}

function candleDiscriminator(coin: string, interval: unknown): string {
  return typeof interval === "string" ? `${coin}|i=${interval}` : coin;
}

function bookDiscriminator(coin: string, fast: unknown): string {
  return `${coin}|${fast === true ? "1" : "0"}`;
}

export function bookRouteDiscriminator(subscription: L2BookSubscription): string {
  const sigFigs = typeof subscription.nSigFigs === "number" ? String(subscription.nSigFigs) : "";
  return `${subscription.coin}|${sigFigs}|${subscription.fast === true ? "1" : "0"}`;
}

function recordOf(data: unknown): Record<string, unknown> | undefined {
  const value: unknown = Array.isArray(data) ? cast<readonly unknown[]>(data, "data")[0] : data;
  if (typeof value !== "object" || value === null) return undefined;
  return cast<Record<string, unknown>>(value, "data");
}

function scopeOf(record: Record<string, unknown>): string {
  const coin = record["coin"];
  if (typeof coin === "string") return coin;
  const user = record["user"];
  if (typeof user === "string") return user;
  const dex = record["dex"];
  if (typeof dex === "string") return dex;
  return "";
}

export function subscriptionDiscriminatorOf(subscription: Subscription): string {
  if (subscription.type === "candle") {
    return candleDiscriminator(subscription.coin, subscription.interval);
  }
  if (subscription.type === "l2Book") {
    return bookDiscriminator(subscription.coin, subscription.fast);
  }
  if ("coin" in subscription && typeof subscription.coin === "string") return subscription.coin;
  if ("user" in subscription && typeof subscription.user === "string") return subscription.user;
  if ("dex" in subscription && typeof subscription.dex === "string") return subscription.dex;
  return "";
}

export function coreDiscriminatorOf(data: unknown): string {
  const record = recordOf(data);
  return record === undefined ? "" : scopeOf(record);
}

export function frameDiscriminatorOf(channel: string, data: unknown): string {
  const record = recordOf(data);
  if (record === undefined) return "";
  if (channel === CHANNEL_OF.candle) {
    const coin = record["s"];
    return typeof coin === "string" ? candleDiscriminator(coin, record["i"]) : "";
  }
  if (channel === CHANNEL_OF.l2Book) {
    const coin = record["coin"];
    if (typeof coin === "string") return bookDiscriminator(coin, record["fast"]);
  }
  return scopeOf(record);
}
