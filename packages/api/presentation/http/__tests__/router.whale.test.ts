import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context, Effect, Layer } from "effect";
import type { WhalePosition } from "@0xsignal/shared";
import { MarketDataService } from "../../../application/market-data/contracts";
import { HealthService } from "../../../application/health";
import { UserDataService } from "../../../application/user-data/contracts";
import { ExchangeService } from "../../../application/exchange/contracts";
import { WhaleService } from "../../../application/whales/contracts";
import { handleRequest } from "../router";

const mockWhaleService = {
  queryPositions: vi.fn(),
};

const TestWhaleLayer = Layer.succeed(
  WhaleService,
  mockWhaleService as unknown as Context.Service.Shape<typeof WhaleService>,
);

const TestMarketDataLayer = Layer.succeed(
  MarketDataService,
  {} as unknown as Context.Service.Shape<typeof MarketDataService>,
);
const TestHealthLayer = Layer.succeed(
  HealthService,
  {} as unknown as Context.Service.Shape<typeof HealthService>,
);
const TestUserDataLayer = Layer.succeed(
  UserDataService,
  {} as unknown as Context.Service.Shape<typeof UserDataService>,
);
const TestExchangeLayer = Layer.succeed(
  ExchangeService,
  {} as unknown as Context.Service.Shape<typeof ExchangeService>,
);

const baseLayers = Layer.mergeAll(
  TestMarketDataLayer,
  TestHealthLayer,
  TestUserDataLayer,
  TestExchangeLayer,
);

const runRequest = (path: string, withWhale = true) =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`)).pipe(
      Effect.provide(withWhale ? Layer.mergeAll(baseLayers, TestWhaleLayer) : baseLayers),
    ),
  );

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
    await expect(response.json()).resolves.toEqual({
      data: { positions: [], nextCursor: null, fetchedAt: expect.any(String) },
    });
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
    await expect(response.json()).resolves.toEqual({
      data: {
        positions: [samplePosition],
        nextCursor: "next",
        fetchedAt: expect.any(String),
      },
    });
    expect(mockWhaleService.queryPositions).toHaveBeenCalledWith({
      side: "sell",
      sort: "funding",
      limit: 10,
    });
  });

  it("returns 503 when the whale service is unwired", async () => {
    const response = await runRequest("/api/whales/positions", false);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Whale service unavailable" });
  });
});
