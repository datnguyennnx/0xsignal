import type { EconomicEvent } from "@0xsignal/shared";
import { normalizeEvent } from "../../../application/calendar/normalizer";

export const FED_SOURCE_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
export const FED_ATTRIBUTION = "Board of Governors of the Federal Reserve System";

export interface ParseOptions {
  readonly fetchedAt?: string | Date;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

interface YearPosition {
  readonly year: number;
  readonly index: number;
}

const collectYears = (text: string): YearPosition[] => {
  const positions: YearPosition[] = [];
  const regex = /(20\d{2})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push({ year: Number(match[1]), index: match.index });
  }
  return positions;
};

const yearForIndex = (positions: readonly YearPosition[], index: number): number | null => {
  let year: number | null = null;
  for (const position of positions) {
    if (position.index > index) break;
    year = position.year;
  }
  return year;
};

export const parse = (body: string, options: ParseOptions = {}): readonly EconomicEvent[] => {
  if (typeof body !== "string" || body.trim() === "") return [];

  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8211;|&ndash;|&mdash;/gi, "-");
  const years = collectYears(text);
  const events: EconomicEvent[] = [];

  const rangeRegex =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})\b/gi;

  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(text)) !== null) {
    const month = MONTHS.indexOf((match[1] ?? "").toLowerCase());
    const startDay = Number(match[2]);
    const endDay = Number(match[3]);
    if (month === -1 || startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) continue;
    const year = yearForIndex(years, match.index);
    if (year === null) continue;
    const date = new Date(Date.UTC(year, month, startDay));
    if (Number.isNaN(date.getTime())) continue;

    events.push(
      normalizeEvent({
        source: "federal-reserve",
        sourceEventId: `${year}-${String(month + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
        title: "FOMC Meeting",
        country: "US",
        currency: "USD",
        category: "macro",
        impact: "high",
        scheduledAt: date,
        allDay: true,
        period: `${match[1]} ${startDay}-${endDay}, ${year}`,
        sourceUrl: FED_SOURCE_URL,
        attribution: FED_ATTRIBUTION,
        fetchedAt: options.fetchedAt,
      }),
    );
  }
  return events;
};
