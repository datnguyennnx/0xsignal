import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { getAggregatedMarketsSnapshot } from "../aggregated-markets";
import { HyperliquidError } from "../errors";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";
import type { HyperliquidInfoClient } from "../types";
import { asDecimal } from "@0xsignal/sdk-hyperliquid";
import type { MetaAndAssetCtxsInfoResponse } from "@0xsignal/sdk-hyperliquid/info";

const perpDex = (name: string) => ({
  name,
  fullName: name,
  deployer: "",
  oracleUpdater: null,
  feeRecipient: null,
  assetToStreamingOiCap: null,
  assetToFundingMultiplier: null,
});

const perpUniverse = (name: string, szDecimals = 4, maxLeverage = 10) => ({
  name,
  szDecimals,
  maxLeverage,
});

const perpCtx = (dayNtlVlm = "0") => ({
  funding: asDecimal("0"),
  openInterest: asDecimal("0"),
  prevDayPx: asDecimal("0"),
  dayNtlVlm: asDecimal(dayNtlVlm),
  premium: null,
  oraclePx: asDecimal("0"),
  markPx: asDecimal("0"),
  midPx: null,
  impactPxs: null,
});

const spotToken = (name: string, index: number, szDecimals = 0) => ({
  name,
  szDecimals,
  weiDecimals: 8,
  index,
  tokenId: `0x${index}`,
  isCanonical: true,
  evmContract: null,
  fullName: name,
});

const spotPair = (name: string, tokens: [number, number], index: number) => ({
  name,
  tokens,
  index,
  isCanonical: true,
});

const spotCtx = (dayNtlVlm: string) => ({
  dayNtlVlm: asDecimal(dayNtlVlm),
  markPx: asDecimal("0"),
  midPx: null,
  prevDayPx: asDecimal("0"),
  circulatingSupply: asDecimal("500000"),
  totalSupply: asDecimal("500000"),
});

const createMockInfoClient = () => ({
  metaAndAssetCtxs: vi
    .fn<HyperliquidInfoClient["metaAndAssetCtxs"]>()
    .mockResolvedValue([{ universe: [], marginTables: [] }, []]),
  allMids: vi.fn<HyperliquidInfoClient["allMids"]>().mockResolvedValue({}),
  perpCategories: vi
    .fn<NonNullable<HyperliquidInfoClient["perpCategories"]>>()
    .mockResolvedValue([]),
  perpDexs: vi.fn<NonNullable<HyperliquidInfoClient["perpDexs"]>>().mockResolvedValue([]),
  spotMeta: vi
    .fn<NonNullable<HyperliquidInfoClient["spotMeta"]>>()
    .mockResolvedValue({ universe: [], tokens: [] }),
  spotMetaAndAssetCtxs: vi
    .fn<NonNullable<HyperliquidInfoClient["spotMetaAndAssetCtxs"]>>()
    .mockResolvedValue([{ universe: [], tokens: [] }, []]),
  meta: vi
    .fn<HyperliquidInfoClient["meta"]>()
    .mockResolvedValue({ universe: [], marginTables: [] }),
});

const infoAsClient = (info: ReturnType<typeof createMockInfoClient>): HyperliquidInfoClient => info;

const runSnapshot = (info: ReturnType<typeof createMockInfoClient>) =>
  Effect.runPromiseExit(
    Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
  );

const failureCause = <A, E>(exit: Exit.Exit<A, E>): Cause.Cause<E> =>
  Option.getOrThrow(
    Exit.match(exit, {
      onSuccess: () => Option.none<Cause.Cause<E>>(),
      onFailure: (cause) => Option.some(cause),
    }),
  );

const failureKinds = <A>(exit: Exit.Exit<A, HyperliquidError>): ReadonlyArray<string | undefined> =>
  failureCause(exit)
    .reasons.filter(Cause.isFailReason)
    .map((reason) => reason.error.kind);

const rateLimited = () => new HyperliquidError({ message: "rate limited", kind: "RATE_LIMITED" });

describe("getAggregatedMarketsSnapshot rate-limit propagation", () => {
  it("surfaces a rate-limited main-dex fetch as RATE_LIMITED, never UPSTREAM", async () => {
    const info = createMockInfoClient();
    info.metaAndAssetCtxs.mockRejectedValue(rateLimited());

    const exit = await runSnapshot(info);

    expect(Exit.isFailure(exit)).toBe(true);
    const kinds = failureKinds(exit);
    expect(kinds).toContain("RATE_LIMITED");
    expect(kinds).not.toContain("UPSTREAM");
  });

  it("surfaces a rate-limited allMids fetch instead of degrading to an empty price map", async () => {
    const info = createMockInfoClient();
    info.allMids.mockRejectedValue(rateLimited());

    const exit = await runSnapshot(info);

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureKinds(exit)).toContain("RATE_LIMITED");
  });

  it("surfaces a rate-limited builder-dex fetch instead of silently skipping that dex", async () => {
    const info = createMockInfoClient();
    info.perpDexs.mockResolvedValue([null, perpDex("xyz")]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [perpUniverse("BTC")], marginTables: [] }, []])
      .mockRejectedValueOnce(rateLimited());

    const exit = await runSnapshot(info);

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureKinds(exit)).toContain("RATE_LIMITED");
  });

  it("still renders the remaining dexes when one builder dex fails for a non-rate-limit reason", async () => {
    const info = createMockInfoClient();
    info.perpDexs.mockResolvedValue([null, perpDex("xyz")]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [perpUniverse("BTC")], marginTables: [] }, []])
      .mockRejectedValueOnce(new Error("DEX offline"));
    info.allMids.mockResolvedValue({ BTC: asDecimal("100") });

    const result = await Effect.runPromise(
      Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
    );

    expect(result.some((asset) => asset.rawCoin === "BTC")).toBe(true);
  });

  it("uses the perpDexs position as the builder dex id offset", async () => {
    const info = createMockInfoClient();
    info.perpDexs.mockResolvedValue([null, perpDex("xyz")]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [perpUniverse("BTC")], marginTables: [] }, []])
      .mockResolvedValueOnce([{ universe: [perpUniverse("EUR")], marginTables: [] }, []]);

    const result = await Effect.runPromise(
      Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
    );

    expect(result.find((asset) => asset.rawCoin === "BTC")?.assetId).toBe(0);
    // xyz sits at perpDexs[1] → 100000 + 1 * 10000 + 0.
    expect(result.find((asset) => asset.rawCoin === "xyz:EUR")?.assetId).toBe(110000);
  });

  it("leaves every other id unchanged when a builder dex fails", async () => {
    const info = createMockInfoClient();
    info.perpDexs.mockResolvedValue([null, perpDex("offline"), perpDex("xyz")]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [perpUniverse("BTC")], marginTables: [] }, []])
      .mockRejectedValueOnce(new Error("DEX offline"))
      .mockResolvedValueOnce([{ universe: [perpUniverse("EUR")], marginTables: [] }, []]);

    const result = await Effect.runPromise(
      Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
    );

    expect(result.find((asset) => asset.rawCoin === "BTC")?.assetId).toBe(0);
    // The skipped dex keeps its slot: xyz stays at position 2, not re-counted to 1.
    expect(result.find((asset) => asset.rawCoin === "xyz:EUR")?.assetId).toBe(120000);
  });

  it("builds the same markets in the same order from a mixed spot/perp fixture", async () => {
    const info = createMockInfoClient();
    info.spotMeta.mockResolvedValue({
      universe: [],
      tokens: [spotToken("USDC", 0), spotToken("USDT", 1)],
    });
    info.perpDexs.mockResolvedValue([]);
    info.perpCategories.mockResolvedValue([
      ["BTC", "crypto"],
      ["ETH", "crypto"],
    ]);
    const mainMeta: MetaAndAssetCtxsInfoResponse[0] & { collateralToken: number } = {
      collateralToken: 1,
      universe: [perpUniverse("BTC", 5, 50), perpUniverse("ETH", 4, 25)],
      marginTables: [],
    };
    info.metaAndAssetCtxs.mockResolvedValue([mainMeta, [perpCtx("200"), perpCtx("100")]]);
    info.allMids.mockResolvedValue({
      BTC: asDecimal("100"),
      ETH: asDecimal("200"),
      "@1": asDecimal("30"),
    });
    info.spotMetaAndAssetCtxs.mockResolvedValue([
      {
        universe: [spotPair("@1", [2, 0], 1)],
        tokens: [spotToken("USDC", 0), spotToken("USDT", 1), spotToken("HYPE", 2, 2)],
      },
      [spotCtx("50")],
    ]);

    const result = await Effect.runPromise(
      Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
    );

    expect(result.map((asset) => asset.rawCoin)).toEqual(["BTC", "ETH", "HYPE/USDC"]);
    // The perp quote currency still resolves through the spot token list.
    expect(result.find((asset) => asset.rawCoin === "BTC")?.quoteCurrency).toBe("USDT");
    // `/api/markets` must carry the supply the app multiplies by mark price.
    expect(result.find((asset) => asset.rawCoin === "HYPE/USDC")?.circulatingSupply).toBe("500000");
  });
});
