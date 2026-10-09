import { describe, expect, it } from "vitest";
import { stableId, normalizeEvent, slugify } from "../normalizer";
import { parse as parseBls, BLS_ATTRIBUTION } from "../../../infrastructure/data-sources/bls/parse";
import { parse as parseBea, BEA_ATTRIBUTION } from "../../../infrastructure/data-sources/bea/parse";
import {
  parse as parseFed,
  FED_ATTRIBUTION,
} from "../../../infrastructure/data-sources/federal-reserve/parse";
import {
  parse as parseForexFactory,
  FOREXFACTORY_ATTRIBUTION,
} from "../../../infrastructure/data-sources/forexfactory/parse";
import {
  parse as parseSecEdgar,
  SEC_EDGAR_ATTRIBUTION,
} from "../../../infrastructure/data-sources/sec-edgar/parse";

const BLS_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:bls-cpi-2026-01",
  "SUMMARY:Consumer Price Index",
  "DTSTART;VALUE=DATE:20260113",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:bls-emp-2026-02",
  "SUMMARY:Employment Situation",
  "DTSTART:20260206T133000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:bls-ppi-2026-03",
  "SUMMARY:Producer Price Index",
  "DTSTART;VALUE=DATE:20260318",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

// Real shape: DTSTART carries a TZID param with a local time (no trailing Z),
// and a folded continuation line.
const BLS_ICS_REAL = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//BLS//Schedule//EN",
  "BEGIN:VEVENT",
  "UID:bls-cpi-oct-2025",
  "SUMMARY:Consumer Price Index",
  "DTSTART;TZID=US-Eastern:20251024T083000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:bls-jolts-nov-2026",
  "SUMMARY:Job Openings and Labor Turnover Survey",
  "DTSTART;TZID=US-Eastern:20261104T100000",
  "DESCRIPTION:Folded description line that",
  " continues here",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const BEA_JSON = JSON.stringify({
  release_dates: [
    { release_name: "Personal Income and Outlays", date: "2026-01-30" },
    { release_name: "Gross Domestic Product, 4th Quarter", date: "2026-02-27" },
  ],
});

// Real shape: a top-level object mapping release name -> { release_dates: [...] },
// with a non-release metadata key ("file_last_updated") that must be ignored.
const BEA_REAL_JSON = JSON.stringify({
  "Gross Domestic Product": {
    release_dates: ["2026-10-29T12:30:00+00:00", "2026-11-25T13:30:00+00:00"],
  },
  "U.S. International Trade in Goods and Services": {
    release_dates: ["2026-10-06T12:30:00+00:00"],
  },
  "Personal Income and Outlays": {
    release_dates: ["2026-10-30T12:30:00+00:00"],
  },
  file_last_updated: "2026-10-01T14:53:19.724329",
});

const FED_HTML = [
  "<html><body>",
  "<h3>2026 FOMC Meetings</h3>",
  "<table>",
  "<tr><td>January</td><td>27-28</td></tr>",
  "<tr><td>March</td><td>17-18</td></tr>",
  "</table>",
  "<h3>2027 FOMC Meetings</h3>",
  "<table>",
  "<tr><td>January</td><td>26-27</td></tr>",
  "</table>",
  "</body></html>",
].join("\n");

// Real shape: a bare JSON array; keys are exactly title/country/date/impact/forecast/previous,
// and `country` is a currency code or "All".
const FOREXFACTORY_JSON = JSON.stringify([
  {
    title: "Prelim UoM Consumer Sentiment",
    country: "USD",
    date: "2026-10-09T10:00:00-04:00",
    impact: "Medium",
    forecast: "47.5",
    previous: "47.8",
  },
  {
    title: "German Industrial Production m/m",
    country: "EUR",
    date: "2026-10-09T02:00:00-04:00",
    impact: "High",
    forecast: "0.2%",
    previous: "-0.3%",
  },
  {
    title: "Bank Holiday",
    country: "All",
    date: "2026-10-12T00:00:00-04:00",
    impact: "Holiday",
    forecast: "",
    previous: "",
  },
]);

// Real shape: EDGAR full-text search wraps records in hits.hits[], each with a
// _source carrying display_names/file_date/root_forms/file_type.
const SEC_EDGAR_JSON = JSON.stringify({
  hits: {
    hits: [
      {
        _id: "0001193125-26-123456:primary_doc.htm",
        _source: {
          display_names: ["Bitwise XRP ETF  (CIK 0001234567)"],
          file_date: "2026-10-08",
          root_forms: ["S-1"],
          file_type: "S-1",
        },
      },
      {
        _id: "0001193125-26-654321:primary_doc.htm",
        _source: {
          display_names: ["CoinShares Solana ETF Trust  (CIK 0007654321)"],
          file_date: "2026-10-07",
          root_forms: ["S-1"],
          file_type: "S-1/A",
        },
      },
    ],
  },
});

describe("stableId", () => {
  it("is deterministic for the same input", () => {
    expect(stableId("bls", "event-1")).toBe(stableId("bls", "event-1"));
  });

  it("differs across sources and ids", () => {
    expect(stableId("bls", "event-1")).not.toBe(stableId("bea", "event-1"));
    expect(stableId("bls", "event-1")).not.toBe(stableId("bls", "event-2"));
  });
});

describe("normalizeEvent", () => {
  it("derives the id from stableId and normalizes optionals", () => {
    const event = normalizeEvent({
      source: "bea",
      sourceEventId: "abc",
      title: "GDP",
      country: "US",
      currency: "USD",
      category: "macro",
      impact: "medium",
      scheduledAt: new Date("2026-01-30T00:00:00.000Z"),
      attribution: "x",
      fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(event.id).toBe(stableId("bea", "abc"));
    expect(event.scheduledAt).toBe("2026-01-30T00:00:00.000Z");
    expect(event.period).toBeNull();
    expect(event.allDay).toBe(false);
  });
});

describe("parseBls", () => {
  it("parses ICS VEVENTs with impact rules and ISO dates", () => {
    const events = parseBls(BLS_ICS);

    expect(events).toHaveLength(3);
    expect(events.every((event) => event.source === "bls")).toBe(true);
    expect(events.every((event) => event.category === "macro")).toBe(true);
    expect(events.every((event) => event.currency === "USD")).toBe(true);
    expect(events.every((event) => event.attribution === BLS_ATTRIBUTION)).toBe(true);

    const cpi = events.find((event) => event.title === "Consumer Price Index");
    expect(cpi?.impact).toBe("high");
    expect(cpi?.scheduledAt).toBe("2026-01-13T00:00:00.000Z");
    expect(cpi?.allDay).toBe(true);

    const employment = events.find((event) => event.title === "Employment Situation");
    expect(employment?.impact).toBe("high");
    expect(employment?.scheduledAt).toBe("2026-02-06T13:30:00.000Z");
    expect(employment?.allDay).toBe(false);

    const ppi = events.find((event) => event.title === "Producer Price Index");
    expect(ppi?.impact).toBe("medium");
  });

  it("converts TZID local times to UTC and survives folded lines", () => {
    const events = parseBls(BLS_ICS_REAL);

    expect(events).toHaveLength(2);

    const cpi = events.find((event) => event.title === "Consumer Price Index");
    expect(cpi?.scheduledAt).toBe("2025-10-24T12:30:00.000Z");
    expect(cpi?.allDay).toBe(false);

    const jolts = events.find((event) => event.title.startsWith("Job Openings and Labor Turnover"));
    expect(jolts?.scheduledAt).toBe("2026-11-04T15:00:00.000Z");
  });

  it("returns [] for empty or invalid input", () => {
    expect(parseBls("")).toEqual([]);
    expect(parseBls("not an ics feed")).toEqual([]);
  });
});

describe("parseBea", () => {
  it("parses the release_dates array", () => {
    const events = parseBea(BEA_JSON);

    expect(events).toHaveLength(2);
    expect(events.every((event) => event.source === "bea")).toBe(true);
    expect(events.every((event) => event.attribution === BEA_ATTRIBUTION)).toBe(true);
    expect(events.every((event) => event.impact === "medium")).toBe(true);
    expect(events[0]?.title).toBe("Personal Income and Outlays");
    expect(events[0]?.scheduledAt).toBe("2026-01-30T00:00:00.000Z");
  });

  it("parses the live nested release-name -> release_dates object", () => {
    const events = parseBea(BEA_REAL_JSON);

    expect(events).toHaveLength(4);
    expect(events.every((event) => event.source === "bea")).toBe(true);

    const gdp = events.filter((event) => event.title === "Gross Domestic Product");
    expect(gdp).toHaveLength(2);
    expect(gdp[0]?.scheduledAt).toBe("2026-10-29T12:30:00.000Z");
    expect(gdp[1]?.scheduledAt).toBe("2026-11-25T13:30:00.000Z");

    const trade = events.find(
      (event) => event.title === "U.S. International Trade in Goods and Services",
    );
    expect(trade?.scheduledAt).toBe("2026-10-06T12:30:00.000Z");
    expect(events.some((event) => event.title === "file_last_updated")).toBe(false);
  });

  it("accepts a bare array and survives malformed JSON", () => {
    expect(parseBea('[{"description":"Retail sales","date":"2026-03-16"}]')).toHaveLength(1);
    expect(parseBea("{ not json")).toEqual([]);
    expect(parseBea("")).toEqual([]);
  });
});

describe("parseFed", () => {
  it("extracts FOMC ranges and attributes the active year", () => {
    const events = parseFed(FED_HTML);

    expect(events).toHaveLength(3);
    expect(events.every((event) => event.source === "federal-reserve")).toBe(true);
    expect(events.every((event) => event.attribution === FED_ATTRIBUTION)).toBe(true);
    expect(events.every((event) => event.impact === "high")).toBe(true);
    expect(events.every((event) => event.title === "FOMC Meeting")).toBe(true);

    expect(events[0]?.scheduledAt).toBe("2026-01-27T00:00:00.000Z");
    expect(events[2]?.scheduledAt).toBe("2027-01-26T00:00:00.000Z");
  });

  it("returns [] for junk input", () => {
    expect(parseFed("")).toEqual([]);
    expect(parseFed("<html><body>No meetings here</body></html>")).toEqual([]);
  });
});

describe("parseForexFactory", () => {
  it("maps the weekly feed array into fx events", () => {
    const events = parseForexFactory(FOREXFACTORY_JSON);

    expect(events).toHaveLength(3);
    expect(events.every((event) => event.source === "forexfactory")).toBe(true);
    expect(events.every((event) => event.attribution === FOREXFACTORY_ATTRIBUTION)).toBe(true);
    expect(events.every((event) => event.category === "fx")).toBe(true);

    const sentiment = events.find((event) => event.title === "Prelim UoM Consumer Sentiment");
    expect(sentiment?.currency).toBe("USD");
    expect(sentiment?.country).toBe("US");
    expect(sentiment?.impact).toBe("medium");
    expect(sentiment?.scheduledAt).toBe("2026-10-09T14:00:00.000Z");
    expect(sentiment?.forecast).toBe("47.5");
    expect(sentiment?.previous).toBe("47.8");

    const production = events.find((event) => event.title === "German Industrial Production m/m");
    expect(production?.currency).toBe("EUR");
    expect(production?.country).toBe("EU");
    expect(production?.impact).toBe("high");

    const holiday = events.find((event) => event.title === "Bank Holiday");
    expect(holiday?.currency).toBeNull();
    expect(holiday?.country).toBe("US");
    expect(holiday?.impact).toBe("low");
    expect(holiday?.forecast).toBeNull();
    expect(holiday?.previous).toBeNull();
  });

  it("returns [] for empty, non-array, or malformed input", () => {
    expect(parseForexFactory("")).toEqual([]);
    expect(parseForexFactory("not json")).toEqual([]);
    expect(parseForexFactory("{}")).toEqual([]);
    expect(parseForexFactory('[{"title":"No date"}]')).toEqual([]);
  });
});

describe("parseSecEdgar", () => {
  it("maps full-text hits into crypto S-1 events", () => {
    const events = parseSecEdgar(SEC_EDGAR_JSON);

    expect(events).toHaveLength(2);
    expect(events.every((event) => event.source === "sec-edgar")).toBe(true);
    expect(events.every((event) => event.attribution === SEC_EDGAR_ATTRIBUTION)).toBe(true);
    expect(events.every((event) => event.category === "crypto")).toBe(true);
    expect(events.every((event) => event.country === "US")).toBe(true);
    expect(events.every((event) => event.currency === null)).toBe(true);
    expect(events.every((event) => event.impact === "medium")).toBe(true);
    expect(events.every((event) => event.allDay)).toBe(true);

    expect(events[0]?.title).toBe("Bitwise XRP ETF (CIK 0001234567) S-1");
    expect(events[0]?.scheduledAt).toBe("2026-10-08T00:00:00.000Z");
    expect(events[0]?.sourceEventId).toBe("0001193125-26-123456:primary_doc.htm");
    expect(events[0]?.sourceUrl).toContain("sec.gov");
  });

  it("defaults the form and returns [] when hits are missing", () => {
    const events = parseSecEdgar(
      JSON.stringify({
        hits: {
          hits: [{ _source: { display_names: ["Acme Crypto ETF"], file_date: "2026-10-06" } }],
        },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Acme Crypto ETF S-1");

    expect(parseSecEdgar("")).toEqual([]);
    expect(parseSecEdgar("not json")).toEqual([]);
    expect(parseSecEdgar("{}")).toEqual([]);
    expect(parseSecEdgar('{"hits":{}}')).toEqual([]);
  });
});

describe("parse determinism", () => {
  it("produces identical ids across repeated runs", () => {
    const first = parseBls(BLS_ICS).map((event) => event.id);
    const second = parseBls(BLS_ICS).map((event) => event.id);
    expect(first).toEqual(second);
  });

  it("slugify is stable and bounded", () => {
    expect(slugify("Employment Situation")).toBe("employment-situation");
    expect(slugify("  ")).toBe("");
  });
});
