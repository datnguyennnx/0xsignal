import { describe, expect, it } from "vitest";
import { type EventFields, normalizeEvent } from "../normalizer";

const FIELDS: EventFields = {
  source: "bea",
  sourceEventId: "gdp-2026-q4",
  title: "Gross Domestic Product, 4th Quarter",
  country: "US",
  currency: "USD",
  category: "macro",
  impact: "medium",
  scheduledAt: "2026-12-23T13:30:00.000Z",
  attribution: "U.S. Bureau of Economic Analysis",
};

const EARLY = Date.UTC(2026, 9, 1, 12, 0, 0);
const LATE = Date.UTC(2026, 9, 1, 12, 0, 1);

// Impossible before the clock was a parameter: the old normalizer called
// new Date() itself, so no test could supply a clock or observe which it read.
describe("normalizeEvent clock injection", () => {
  it("stamps fetchedAt from now and leaves every other field alone", () => {
    const early = normalizeEvent(FIELDS, EARLY);
    const late = normalizeEvent(FIELDS, LATE);

    expect(early.fetchedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(late.fetchedAt).toBe("2026-10-01T12:00:01.000Z");
    expect(early).not.toEqual(late);
    expect(late).toEqual({ ...early, fetchedAt: "2026-10-01T12:00:01.000Z" });
    expect(late.scheduledAt).toBe("2026-12-23T13:30:00.000Z");
    expect(late.id).toBe(early.id);
  });

  it("is pure across runs when now is held fixed", () => {
    expect(normalizeEvent(FIELDS, EARLY)).toEqual(normalizeEvent(FIELDS, EARLY));
  });
});
