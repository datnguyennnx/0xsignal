import { Match } from "effect";
import { normalizeSymbol } from "../../../infrastructure/data-sources/hyperliquid/symbol";
import {
  MARKET_WS_INTERVALS,
  type MarketWsChannel,
  type MarketWsInterval,
  type MarketWsSubscription,
} from "../../../schemas/market-data/ws";
import { parseOptionalSigFigsParam } from "../utils/param-parsers";

export type ParseResult =
  | { readonly ok: true; readonly data: MarketWsSubscription }
  | { readonly ok: false; readonly status: number; readonly message: string };

export const parseMarketWsSubscription = (params: URLSearchParams): ParseResult => {
  const channel = (params.get("channel") ?? params.get("type") ?? "").trim() as MarketWsChannel;
  if (!channel) {
    return {
      ok: false,
      status: 400,
      message: "Missing required query parameter: channel",
    };
  }

  const validatedChannel = Match.value(channel).pipe(
    Match.when("candle", () => "candle" as const),
    Match.when("l2Book", () => "l2Book" as const),
    Match.when("trades", () => "trades" as const),
    Match.when("allMids", () => "allMids" as const),
    Match.orElse(() => {
      return {
        ok: false as const,
        status: 400,
        message: `Unsupported channel: ${channel}`,
      };
    })
  );

  if (typeof validatedChannel !== "string") {
    return validatedChannel;
  }

  const rawSymbol = params.get("symbol") ?? params.get("coin") ?? "";
  // normalizeSymbol handles all types natively (spot, perp, builderPerp).
  // Spots like "PURR/USDC" pass through unchanged; perps like "BTCUSDT" get normalized.
  const symbol = normalizeSymbol(rawSymbol);

  if (channel === "candle") {
    if (!symbol) {
      return {
        ok: false,
        status: 400,
        message: "Missing required query parameter: symbol",
      };
    }

    const interval = (params.get("interval") ?? "1m").trim();
    if (!MARKET_WS_INTERVALS.includes(interval as MarketWsInterval)) {
      return {
        ok: false,
        status: 400,
        message: `Unsupported interval: ${interval}`,
      };
    }

    return {
      ok: true,
      data: {
        channel,
        symbol,
        interval: interval as MarketWsInterval,
      },
    };
  }

  if (channel === "l2Book") {
    if (!symbol) {
      return {
        ok: false,
        status: 400,
        message: "Missing required query parameter: symbol",
      };
    }

    const nSigFigs = parseOptionalSigFigsParam(params, "nSigFigs");
    const depth = parseOptionalSigFigsParam(params, "depth");
    if (nSigFigs === null || depth === null) {
      return {
        ok: false,
        status: 400,
        message: "Invalid nSigFigs/depth. Supported values are 2, 3, 4, 5.",
      };
    }

    return {
      ok: true,
      data: {
        channel,
        symbol,
        nSigFigs: nSigFigs ?? depth ?? undefined,
      },
    };
  }

  if (channel === "trades") {
    if (!symbol) {
      return {
        ok: false,
        status: 400,
        message: "Missing required query parameter: symbol",
      };
    }

    return {
      ok: true,
      data: {
        channel,
        symbol,
      },
    };
  }

  const dex = params.get("dex")?.trim();
  return {
    ok: true,
    data: {
      channel,
      dex,
    },
  };
};
