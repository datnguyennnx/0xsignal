import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context, Effect, Layer } from "effect";
import type { EconomicEvent } from "@0xsignal/shared";
import { MarketDataService } from "../../../application/market-data/contracts";
import { HealthService } from "../../../application/health";
import { UserDataService } from "../../../application/user-data/contracts";
import { ExchangeService } from "../../../application/exchange/contracts";
import { CalendarService } from "../../../application/calendar/contracts";
import { handleRequest } from "../router";

const mockCalendarService = {
  ingest: vi.fn(),
  query: vi.fn(),
  upcoming: vi.fn(),
};

const TestCalendarLayer = Layer.succeed(
  CalendarService,
  mockCalendarService as unknown as Context.Service.Shape<typeof CalendarService>,
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

const runRequest = (path: string, method = "GET") =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`, { method })).pipe(
      Effect.provide(
        Layer.mergeAll(
          TestMarketDataLayer,
          TestHealthLayer,
          TestUserDataLayer,
          TestExchangeLayer,
          TestCalendarLayer,
        ),
      ),
    ),
  );

const sampleEvent: EconomicEvent = {
  id: "bls-1",
  source: "bls",
  sourceEventId: "1",
  title: "Consumer Price Index",
  country: "US",
  currency: "USD",
  category: "macro",
  impact: "high",
  scheduledAt: "2026-01-13T00:00:00.000Z",
  allDay: true,
  period: null,
  forecast: null,
  previous: null,
  actual: null,
  revised: null,
  sourceUrl: null,
  attribution: "BLS",
  fetchedAt: "2026-01-01T00:00:00.000Z",
};

describe("HTTP Calendar Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCalendarService.ingest.mockReturnValue(Effect.succeed({ inserted: 0, sources: [] }));
    mockCalendarService.query.mockReturnValue(Effect.succeed([]));
    mockCalendarService.upcoming.mockReturnValue(Effect.succeed([]));
  });

  it("returns 200 with the calendar envelope", async () => {
    const response = await runRequest("/api/calendar");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { events: [], sources: [], fetchedAt: expect.any(String) },
    });
    expect(mockCalendarService.query).toHaveBeenCalledWith({});
  });

  it("derives sources from the returned events", async () => {
    mockCalendarService.query.mockReturnValue(Effect.succeed([sampleEvent]));

    const response = await runRequest("/api/calendar");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        events: [sampleEvent],
        sources: ["bls"],
        fetchedAt: expect.any(String),
      },
    });
  });

  it("ignores invalid query tokens instead of failing", async () => {
    const response = await runRequest(
      "/api/calendar?impact=bogus,high&category=nonsense&limit=abc&from=not-a-date",
    );

    expect(response.status).toBe(200);
    expect(mockCalendarService.query).toHaveBeenCalledWith({ impact: ["high"] });
  });

  it("passes parsed filters through", async () => {
    const response = await runRequest(
      "/api/calendar?impact=low,high&category=macro&currency=usd,eur&limit=25",
    );

    expect(response.status).toBe(200);
    expect(mockCalendarService.query).toHaveBeenCalledWith({
      impact: ["low", "high"],
      category: ["macro"],
      currency: ["USD", "EUR"],
      limit: 25,
    });
  });

  it("routes /api/calendar/upcoming with default hours", async () => {
    const response = await runRequest("/api/calendar/upcoming");

    expect(response.status).toBe(200);
    expect(mockCalendarService.upcoming).toHaveBeenCalledWith(24);
  });

  it("honors an explicit hours parameter", async () => {
    const response = await runRequest("/api/calendar/upcoming?hours=48");

    expect(response.status).toBe(200);
    expect(mockCalendarService.upcoming).toHaveBeenCalledWith(48);
  });
});
