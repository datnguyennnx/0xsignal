import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import type { WhalePosition } from "@0xsignal/shared";
import { MarketDataService } from "../../../modules/market-data";
import { HealthService } from "../../../modules/health";
import { UserDataService } from "../../../modules/user-data";
import { WhaleService } from "../../../modules/whales";
import { handleRequest } from "../../../app";
import { TestRouteEnvLayer } from "../../../app/__tests__/route-test-layer";

const mockWhaleService = {
  queryPositions: vi.fn<Context.Service.Shape<typeof WhaleService>["queryPositions"]>(),
};

const TestWhaleLayer = Layer.mock(WhaleService, mockWhaleService);

const TestMarketDataLayer = Layer.mock(MarketDataService, {});
const TestHealthLayer = Layer.mock(HealthService, {});
const TestUserDataLayer = Layer.mock(UserDataService, {});

const baseLayers = Layer.mergeAll(
  TestMarketDataLayer,
  TestHealthLayer,
  TestUserDataLayer,
  TestRouteEnvLayer,
);

const runRequest = (path: string, withWhale = true) =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`)).pipe(
      Effect.provide(withWhale ? Layer.mergeAll(baseLayers, TestWhaleLayer) : baseLayers),
    ),
  );

type LooseEnvelope = { data: Record<string, unknown> };

const envelope = (data: Record<string, unknown>): LooseEnvelope => ({ data });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const bodyOf = async (response: Response): Promise<Record<string, unknown>> => {
  const parsed: unknown = await response.json();
  return isRecord(parsed) ? { ...parsed } : {};
};

const samplePosition: WhalePosition = {
  userAddress: "0xwhale",
  coin: "BTC",
  side: "sell",
  size: 1.5,
  notionalUsd: 100000,
  entryPx: "65000",
  unrealizedPnl: -5000,
  unrealizedPnlPct: -5,
  entryTime: "2026-01-01T00:00:00.000Z",
};

describe("HTTP Whale Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockWhaleService.queryPositions.mockReturnValue(
      Effect.succeed({ positions: [], nextCursor: null }),
    );
  });

  it("returns 200 with the whale positions envelope", async () => {
    const response = await runRequest("/api/whales/positions");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      envelope({ positions: [], nextCursor: null, fetchedAt: expect.any(String) }),
    );
    expect(mockWhaleService.queryPositions).toHaveBeenCalledWith({
      sort: "notional",
      limit: 50,
    });
  });

  it("passes the parsed query through and returns the page", async () => {
    mockWhaleService.queryPositions.mockReturnValue(
      Effect.succeed({ positions: [samplePosition], nextCursor: "next" }),
    );

    const response = await runRequest("/api/whales/positions?side=sell&sort=funding&limit=10");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      envelope({
        positions: [samplePosition],
        nextCursor: "next",
        fetchedAt: expect.any(String),
      }),
    );
    expect(mockWhaleService.queryPositions).toHaveBeenCalledWith({
      side: "sell",
      sort: "funding",
      limit: 10,
    });
  });

  it("returns 400 when the side is not a known value", async () => {
    const response = await runRequest("/api/whales/positions?side=hodl");

    expect(response.status).toBe(400);
    const sideBody = await bodyOf(response);
    expect(Object.keys(sideBody)).toEqual(["error"]);
    expect(String(sideBody["error"])).toContain("side");
  });

  it("returns 503 when the whale service is unwired", async () => {
    const response = await runRequest("/api/whales/positions", false);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Whale service unavailable" });
  });
});
