import type { WsMarketChannel, WsMarketSubscription } from "@0xsignal/shared";
import { USER_STREAM_CHANNEL_TABLE, type UserStreamChannel } from "./user-stream-types";

const SEPARATOR = ":";
const RAW_PRECISION = "raw";

/**
 * Callers resolve the wire coin before subscribing; keeping the symbol verbatim
 * here is the single rule for casing, so a key can never disagree with the
 * symbol that was actually sent upstream.
 */
const symbolPart = (symbol: string | undefined): string => symbol ?? "";

const precisionPart = (nSigFigs: number | null | undefined): string =>
  nSigFigs == null ? RAW_PRECISION : String(nSigFigs);

const joinKey = (...parts: readonly string[]): string => parts.join(SEPARATOR);

const orderbookKey = (symbol: string, nSigFigs?: number | null): string =>
  joinKey(symbol, precisionPart(nSigFigs));

const marketKey = (subscription: WsMarketSubscription): string => {
  if (subscription.channel === "allMids") return "allMids";
  if (subscription.channel === "l2Book") {
    return joinKey("l2Book", orderbookKey(symbolPart(subscription.symbol), subscription.nSigFigs));
  }
  return joinKey("candle", symbolPart(subscription.symbol), subscription.interval ?? "");
};

const userKey = (channel: UserStreamChannel, user: string): string =>
  joinKey(channel, user.toLowerCase());

interface ParsedSubscriptionKey {
  readonly channel: WsMarketChannel | UserStreamChannel;
  readonly symbol: string | null;
  readonly interval: string | null;
  readonly nSigFigs: number | null;
  readonly user: string | null;
}

const isUserStreamChannel = (value: string | undefined): value is UserStreamChannel =>
  value !== undefined && Object.hasOwn(USER_STREAM_CHANNEL_TABLE, value);

const parsePrecision = (value: string): number | null => {
  const parsed = Number(value);
  return value === RAW_PRECISION || !Number.isFinite(parsed) ? null : parsed;
};

const parseKey = (key: string): ParsedSubscriptionKey | null => {
  if (key === "allMids") {
    return { channel: "allMids", symbol: null, interval: null, nSigFigs: null, user: null };
  }

  const [head, ...rest] = key.split(SEPARATOR);
  if (head === "l2Book") {
    const precision = rest.pop() ?? RAW_PRECISION;
    return {
      channel: "l2Book",
      symbol: rest.join(SEPARATOR),
      interval: null,
      nSigFigs: parsePrecision(precision),
      user: null,
    };
  }
  if (head === "candle") {
    const interval = rest.pop() ?? "";
    return {
      channel: "candle",
      symbol: rest.join(SEPARATOR),
      interval,
      nSigFigs: null,
      user: null,
    };
  }
  if (isUserStreamChannel(head)) {
    return {
      channel: head,
      symbol: null,
      interval: null,
      nSigFigs: null,
      user: rest.join(SEPARATOR),
    };
  }
  return null;
};

/** The one builder for every stream identity the app routes on. */
export const SubscriptionKey = {
  market: marketKey,
  user: userKey,
  orderbook: orderbookKey,
  parse: parseKey,
} as const;

export { resolveCoinWithoutIndex } from "./coin-resolution";
export {
  failureOf,
  type DirectEntry,
  type DirectFailure,
  type DirectHandle,
  type DirectHooks,
  type MarketStreamCallbacks,
} from "./direct-stream-failure";
