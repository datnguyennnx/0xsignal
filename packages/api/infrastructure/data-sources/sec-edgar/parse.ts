import type { EconomicEvent } from "@0xsignal/shared";
import { normalizeEvent, slugify } from "../../../application/calendar/normalizer";
import { asRecord } from "../parse-utils";

export const SEC_EDGAR_SEARCH_URL =
  "https://efts.sec.gov/LATEST/search-index?q=%22etf%22&forms=S-1";
export const SEC_EDGAR_SOURCE_URL =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=S-1&output=atom";
export const SEC_EDGAR_ATTRIBUTION = "U.S. SEC EDGAR";
export const SEC_EDGAR_USER_AGENT = "0xsignal-calendar/1.0 (contact@0xsignal.example)";

export interface ParseOptions {
  readonly fetchedAt?: string | Date;
}

const asTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const firstString = (value: unknown): string | null => {
  const direct = asTrimmedString(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = asTrimmedString(item);
      if (candidate) return candidate;
    }
  }
  return null;
};

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim();

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildEvent = (hit: Record<string, unknown>, options: ParseOptions): EconomicEvent | null => {
  const source = asRecord(hit["_source"]);
  if (!source) return null;
  const fileDate = asTrimmedString(source["file_date"]);
  if (!fileDate) return null;
  const date = parseDate(fileDate);
  if (!date) return null;

  const form = asTrimmedString(source["file_type"]) ?? firstString(source["root_forms"]) ?? "S-1";
  const name = firstString(source["display_names"]) ?? form;
  const title = collapse(`${name} ${form}`);
  if (title === "") return null;

  return normalizeEvent({
    source: "sec-edgar",
    sourceEventId: asTrimmedString(hit["_id"]) ?? `${date.toISOString()}-${slugify(title)}`,
    title,
    country: "US",
    currency: null,
    category: "crypto",
    impact: "medium",
    scheduledAt: date,
    allDay: true,
    sourceUrl: SEC_EDGAR_SOURCE_URL,
    attribution: SEC_EDGAR_ATTRIBUTION,
    fetchedAt: options.fetchedAt,
  });
};

export const parse = (body: string, options: ParseOptions = {}): readonly EconomicEvent[] => {
  if (typeof body !== "string" || body.trim() === "") return [];

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }

  const hits = asRecord(asRecord(data)?.["hits"])?.["hits"];
  if (!Array.isArray(hits)) return [];

  const events: EconomicEvent[] = [];
  for (const raw of hits) {
    const hit = asRecord(raw);
    if (!hit) continue;
    const event = buildEvent(hit, options);
    if (event) events.push(event);
  }
  return events;
};
