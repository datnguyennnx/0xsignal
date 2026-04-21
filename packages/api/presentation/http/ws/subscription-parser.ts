import { normalizeSymbol } from "@infrastructure/data-sources/hyperliquid/symbol";
import {
  MARKET_WS_INTERVALS,
  type MarketWsChannel,
  type MarketWsInterval,
  type MarketWsSubscription,
} from "@schemas/market-data/ws";
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

  if (
    channel !== "candle" &&
    channel !== "l2Book" &&
    channel !== "trades" &&
    channel !== "allMids"
  ) {
    return {
      ok: false,
      status: 400,
      message: `Unsupported channel: ${channel}`,
    };
  }

  const symbol = params.get("symbol") ?? params.get("coin") ?? "";

  if (channel === "candle") {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
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
        symbol: normalized,
        interval: interval as MarketWsInterval,
      },
    };
  }

  if (channel === "l2Book") {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
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
        symbol: normalized,
        nSigFigs: nSigFigs ?? depth,
      },
    };
  }

  if (channel === "trades") {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
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
        symbol: normalized,
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
