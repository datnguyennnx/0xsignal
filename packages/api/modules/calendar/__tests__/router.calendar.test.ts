import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import type { EconomicEvent } from "@0xsignal/shared";
import { MarketDataService } from "../../../modules/market-data";
import { HealthService } from "../../../modules/health";
import { UserDataService } from "../../../modules/user-data";
import { ExchangeService } from "../../../modules/exchange";
import { CalendarService } from "../../../modules/calendar";
import { handleRequest } from "../../../app";
import { TestRouteEnvLayer } from "../../../app/__tests__/route-test-layer";

const mockCalendarService = {
  ingest: vi.fn<Context.Service.Shape<typeof CalendarService>["ingest"]>(),
  query: vi.fn<Context.Service.Shape<typeof CalendarService>["query"]>(),
  upcoming: vi.fn<Context.Service.Shape<typeof CalendarService>["upcoming"]>(),
};

const TestCalendarLayer = Layer.succeed(CalendarService, mockCalendarService);

const TestMarketDataLayer = Layer.mock(MarketDataService, {});
const TestHealthLayer = Layer.mock(HealthService, {});
const TestUserDataLayer = Layer.mock(UserDataService, {});
const TestExchangeLayer = Layer.mock(ExchangeService, {});

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
          TestRouteEnvLayer,
        ),
      ),
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
    await expect(response.json()).resolves.toEqual(
      envelope({ events: [], sources: [], fetchedAt: expect.any(String) }),
    );
    expect(mockCalendarService.query).toHaveBeenCalledWith({});
  });

  it("derives sources from the returned events", async () => {
    mockCalendarService.query.mockReturnValue(Effect.succeed([sampleEvent]));

    const response = await runRequest("/api/calendar");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      envelope({
        events: [sampleEvent],
        sources: ["bls"],
        fetchedAt: expect.any(String),
      }),
    );
  });

  it("rejects an unknown impact token with a 400 naming the field", async () => {
    const response = await runRequest("/api/calendar?impact=bogus,high");

    expect(response.status).toBe(400);
    const body = await bodyOf(response);
    expect(typeof body["error"]).toBe("string");
    expect(String(body["error"])).toContain("impact");
  });

  it("accepts case-varied enum filters and normalizes them", async () => {
    const upperImpact = await runRequest("/api/calendar?impact=HIGH");
    expect(upperImpact.status).toBe(200);
    expect(mockCalendarService.query).toHaveBeenCalledWith({ impact: ["high"] });

    const mixedImpact = await runRequest("/api/calendar?impact=High");
    expect(mixedImpact.status).toBe(200);
    expect(mockCalendarService.query).toHaveBeenCalledWith({ impact: ["high"] });

    const mixedCategory = await runRequest("/api/calendar?category=MACRO");
    expect(mixedCategory.status).toBe(200);
    expect(mockCalendarService.query).toHaveBeenCalledWith({ category: ["macro"] });
  });

  it("rejects an unknown impact token even when it looks normalized", async () => {
    const response = await runRequest("/api/calendar?impact=unknownToken");

    expect(response.status).toBe(400);
    const body = await bodyOf(response);
    expect(typeof body["error"]).toBe("string");
    expect(String(body["error"])).toContain("impact");
  });

  it("rejects a malformed limit or date with a 400 naming the field", async () => {
    const invalidLimit = await runRequest("/api/calendar?limit=abc");
    expect(invalidLimit.status).toBe(400);
    const limitBody = await bodyOf(invalidLimit);
    expect(Object.keys(limitBody)).toEqual(["error"]);
    expect(String(limitBody["error"])).toContain("limit");

    const invalidDate = await runRequest("/api/calendar?from=not-a-date");
    expect(invalidDate.status).toBe(400);
    const dateBody = await bodyOf(invalidDate);
    expect(Object.keys(dateBody)).toEqual(["error"]);
    expect(String(dateBody["error"])).toContain("from");
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

  it("rejects a non-numeric hours parameter with a 400 naming the field", async () => {
    const response = await runRequest("/api/calendar/upcoming?hours=soon");

    expect(response.status).toBe(400);
    const hoursBody = await bodyOf(response);
    expect(Object.keys(hoursBody)).toEqual(["error"]);
    expect(String(hoursBody["error"])).toContain("hours");
  });
});
