import { describe, expect, test } from "bun:test";
import type { MarketPrice } from "@/services/api";
import type { MarketQuote } from "@/services/api/types";
import type { AssetCtxSnapshot } from "@/features/trade/lib/asset-ctx";
import { buildMarketRows } from "@/features/trade/lib/market-row-data";
import { computeLiveCells } from "@/features/trade/lib/format-trade-rows";
import { market } from "@/test/fixtures";
import {
  deriveMarketHeaderValues,
  formatHeaderCompactUsd,
  formatHeaderFunding,
  formatHeaderPrice,
  formatHeaderSignedPercent,
  formatHeaderSignedUsd,
} from "./market-header-values";

const ADDRESS = "0x2222222222222222222222222222222222222222";

const ctx: AssetCtxSnapshot = {
  markPx: 74022.5,
  oraclePx: 74022.5,
  prevDayPx: 74292.5,
  dayNtlVlm: 3.87e9,
  openInterest: 41000,
  funding: 0.00000125,
};

const restQuote: MarketQuote = {
  price: 100,
  change24h: 0,
  volume24h: 1500,
  openInterest: 12,
  funding: 0.0002,
  markPx: 100,
  midPx: 99.5,
  prevDayPx: 90,
};

const price: MarketPrice = {
  symbol: "BTC",
  price: 100,
  change24h: 0,
  volume24h: 1500,
  openInterest: 12,
  funding: 0.0002,
  markPx: 100,
  midPx: 99.5,
  prevDayPx: 90,
  timestamp: new Date(0),
  quote: restQuote,
};

describe("deriveMarketHeaderValues with an activeAssetCtx frame", () => {
  test("all six fields come from the ctx frame, not the REST quote", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 74010,
      price,
      tradeAsset: undefined,
      ctx,
    });

    expect(derived.markPrice).toBe(74022.5);
    expect(derived.oraclePrice).toBe(74022.5);
    expect(derived.change24hAbs).toBe(-270);
    expect(derived.change24hPct).toBeCloseTo(-0.3634, 3);
    expect(derived.volume24h).toBe(3.87e9);
    expect(derived.openInterest).toBe(3_034_922_500);
    expect(derived.fundingRate).toBe(0.00001);
  });

  test("renders the fixture at design precision", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 74010,
      price,
      tradeAsset: undefined,
      ctx,
    });

    expect(formatHeaderPrice(derived.markPrice)).toBe("$74,022.50");
    expect(formatHeaderPrice(derived.oraclePrice)).toBe("$74,022.50");
    expect(formatHeaderSignedUsd(derived.change24hAbs)).toBe("-$270.00");
    expect(formatHeaderSignedPercent(derived.change24hPct)).toBe("-0.36%");
    expect(formatHeaderCompactUsd(derived.volume24h)).toBe("$3.87B");
    expect(formatHeaderCompactUsd(derived.openInterest)).toBe("$3.03B");
    expect(formatHeaderFunding(derived.fundingRate)).toBe("+0.0010%");
  });

  test("the oracle prefers ctx.oraclePx over the REST mid", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 74010,
      price,
      tradeAsset: undefined,
      ctx: { ...ctx, oraclePx: 73980 },
    });

    expect(derived.oraclePrice).toBe(73980);
  });

  test("open interest is the ctx notional in USD", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 74010,
      price,
      tradeAsset: undefined,
      ctx: { ...ctx, openInterest: 100, markPx: 50 },
    });

    expect(derived.openInterest).toBe(5000);
  });

  test("funding matches the markets table for the same ctx", () => {
    const row = buildMarketRows([market({ rawCoin: "BTC", name: "BTC" })]).rows[0];
    const table = computeLiveCells({ row, ctx, midPx: undefined });
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 74010,
      price,
      tradeAsset: undefined,
      ctx,
    });

    expect(formatHeaderFunding(derived.fundingRate)).toBe(table.funding);
  });
});

describe("deriveMarketHeaderValues without a ctx frame", () => {
  test("falls back to the REST quote for every perp field", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 101,
      price,
      tradeAsset: undefined,
      ctx: undefined,
    });

    expect(derived.markPrice).toBe(101);
    expect(derived.oraclePrice).toBe(99.5);
    expect(derived.change24hAbs).toBe(11);
    expect(derived.change24hPct).toBeCloseTo(12.2222, 3);
    expect(derived.volume24h).toBe(1500);
    expect(derived.openInterest).toBe(1200);
    expect(derived.fundingRate).toBe(0.0016);
  });

  test("a zero prevDayPx renders both change parts as --", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 101,
      price: { ...price, quote: { ...restQuote, prevDayPx: 0 } },
      tradeAsset: undefined,
      ctx: { ...ctx, prevDayPx: 0 },
    });

    expect(derived.change24hAbs).toBeNull();
    expect(derived.change24hPct).toBeNull();
    expect(formatHeaderSignedUsd(derived.change24hAbs)).toBe("--");
    expect(formatHeaderSignedPercent(derived.change24hPct)).toBe("--");
  });

  test("a missing prevDayPx renders both change parts as --", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 101,
      price: { ...price, quote: null },
      tradeAsset: undefined,
      ctx: undefined,
    });

    expect(derived.change24hAbs).toBeNull();
    expect(derived.change24hPct).toBeNull();
  });

  test("missing volume and open interest render -- instead of a fake zero", () => {
    const derived = deriveMarketHeaderValues({
      isSpot: false,
      livePrice: 101,
      price: { ...price, quote: null },
      tradeAsset: undefined,
      ctx: undefined,
    });

    expect(derived.volume24h).toBeNull();
    expect(derived.openInterest).toBeNull();
    expect(derived.fundingRate).toBeNull();
    expect(formatHeaderCompactUsd(derived.volume24h)).toBe("--");
    expect(formatHeaderCompactUsd(derived.openInterest)).toBe("--");
    expect(formatHeaderFunding(derived.fundingRate)).toBe("--");
  });
});

describe("deriveMarketHeaderValues contract address", () => {
  test("a string evmContract is preserved unchanged", () => {
    const tradeAsset = market({
      marketType: "spot",
      rawCoin: "AMZN/USDC",
      evmContract: ADDRESS,
    });

    const derived = deriveMarketHeaderValues({
      isSpot: true,
      livePrice: 10,
      price,
      tradeAsset,
    });

    expect(derived.contractAddress).toBe(ADDRESS);
  });
});
