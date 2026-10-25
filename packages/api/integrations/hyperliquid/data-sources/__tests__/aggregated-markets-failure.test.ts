import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { getAggregatedMarketsSnapshot } from "../aggregated-markets";
import { HyperliquidError } from "../errors";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";
import type { HyperliquidInfoClient } from "../types";

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
    info.perpDexs.mockResolvedValue([{ name: "xyz" }]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [{ name: "BTC" }] }, []])
      .mockRejectedValueOnce(rateLimited());

    const exit = await runSnapshot(info);

    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureKinds(exit)).toContain("RATE_LIMITED");
  });

  it("still renders the remaining dexes when one builder dex fails for a non-rate-limit reason", async () => {
    const info = createMockInfoClient();
    info.perpDexs.mockResolvedValue([{ name: "xyz" }]);
    info.metaAndAssetCtxs
      .mockResolvedValueOnce([{ universe: [{ name: "BTC" }] }, []])
      .mockRejectedValueOnce(new Error("DEX offline"));
    info.allMids.mockResolvedValue({ BTC: "100" });

    const result = await Effect.runPromise(
      Effect.provide(getAggregatedMarketsSnapshot(infoAsClient(info)), rateLimiterUnlimited),
    );

    expect(result.some((asset) => asset.rawCoin === "BTC")).toBe(true);
  });
});
