import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import type { WhalePosition } from "@0xsignal/shared";
import { MarketDataService } from "../../../application/market-data/contracts";
import { HealthService } from "../../../application/health";
import { UserDataService } from "../../../application/user-data/contracts";
import { ExchangeService } from "../../../application/exchange/contracts";
import { WhaleService } from "../../../application/whales/contracts";
import { handleRequest } from "../router";
import { TestRouteEnvLayer } from "./route-test-layer";

const mockWhaleService = {
  queryPositions: vi.fn<Context.Service.Shape<typeof WhaleService>["queryPositions"]>(),
};

const TestWhaleLayer = Layer.mock(WhaleService, mockWhaleService);

const TestMarketDataLayer = Layer.mock(MarketDataService, {});
const TestHealthLayer = Layer.mock(HealthService, {});
const TestUserDataLayer = Layer.mock(UserDataService, {});
const TestExchangeLayer = Layer.mock(ExchangeService, {});

const baseLayers = Layer.mergeAll(
  TestMarketDataLayer,
  TestHealthLayer,
  TestUserDataLayer,
  TestExchangeLayer,
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
    expect(JSON.stringify(await response.json())).toContain("side");
  });

  it("returns 503 when the whale service is unwired", async () => {
    const response = await runRequest("/api/whales/positions", false);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Whale service unavailable" });
  });
});
