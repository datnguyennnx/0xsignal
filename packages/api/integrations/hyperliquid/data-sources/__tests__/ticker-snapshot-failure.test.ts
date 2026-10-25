import { beforeEach, describe, expect, it, vi } from "vitest";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { getTicker } from "../provider";
import { HyperliquidClient } from "../client";
import { layerUnlimited as rateLimiterUnlimited } from "../../rate-limit";

const createMockInfoClient = () => ({
  candleSnapshot: vi.fn<InfoClient["candleSnapshot"]>(),
  meta: vi.fn<InfoClient["meta"]>(),
  metaAndAssetCtxs: vi.fn<InfoClient["metaAndAssetCtxs"]>(),
  allMids: vi.fn<InfoClient["allMids"]>(),
  perpCategories: vi.fn<InfoClient["perpCategories"]>(),
  perpDexs: vi.fn<NonNullable<InfoClient["perpDexs"]>>().mockResolvedValue([]),
  spotMeta: vi.fn<InfoClient["spotMeta"]>().mockResolvedValue({ universe: [], tokens: [] }),
  l2Book: vi.fn<InfoClient["l2Book"]>(),
  perpAnnotation: vi.fn<InfoClient["perpAnnotation"]>(),
});

type Meta = Awaited<ReturnType<InfoClient["meta"]>>;

const metaResponse = (names: readonly string[]): Meta => ({
  universe: names.map((name) => ({ name, szDecimals: 2, maxLeverage: 50, marginTableId: 0 })),
  marginTables: [],
  collateralToken: 0,
});

let mockInfoClient: ReturnType<typeof createMockInfoClient>;

const makeClientLayer = () =>
  Layer.mergeAll(
    Layer.succeed(
      HyperliquidClient,
      HyperliquidClient.of({
        info: Object.assign(new InfoClient({ transport: new HttpTransport() }), mockInfoClient),
      }),
    ),
    rateLimiterUnlimited,
  );

const failureCause = <A, E>(exit: Exit.Exit<A, E>): Cause.Cause<E> =>
  Option.getOrThrow(
    Exit.match(exit, {
      onSuccess: () => Option.none<Cause.Cause<E>>(),
      onFailure: (cause) => Option.some(cause),
    }),
  );

describe("getTicker malformed snapshot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockInfoClient = createMockInfoClient();
  });

  it("surfaces TickerSnapshotError as a typed failure instead of a defect", async () => {
    mockInfoClient.metaAndAssetCtxs.mockResolvedValue([metaResponse(["BTC"]), []]);
    mockInfoClient.allMids.mockResolvedValue({ BTC: "101.25" });

    const exit = await Effect.runPromiseExit(
      getTicker("XRP").pipe(Effect.provide(makeClientLayer())),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    const cause = failureCause(exit);
    expect(cause.reasons.some(Cause.isDieReason)).toBe(false);

    const failures = cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
    expect(failures).toContainEqual(
      expect.objectContaining({ _tag: "TickerSnapshotError", kind: "NOT_FOUND" }),
    );
  });
});
