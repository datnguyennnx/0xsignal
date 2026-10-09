import type { EconomicEvent } from "@0xsignal/shared";
import { normalizeEvent, slugify } from "../../../application/calendar/normalizer";

export const BLS_SOURCE_URL = "https://www.bls.gov/schedule/news_release/bls.ics";
export const BLS_ATTRIBUTION = "U.S. Bureau of Labor Statistics";

export interface ParseOptions {
  readonly fetchedAt?: string | Date;
}

const unfold = (body: string): string[] => {
  const raw = body.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
};

const splitProperty = (line: string): { name: string; value: string } | null => {
  const index = line.indexOf(":");
  if (index === -1) return null;
  return { name: line.slice(0, index), value: line.slice(index + 1) };
};

const propertyName = (rawName: string): string => (rawName.split(";")[0] ?? "").toUpperCase();

const unescapeIcsText = (value: string): string =>
  value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

const TZID_ALIASES: Record<string, string> = {
  "us-eastern": "America/New_York",
  "us/central": "America/Chicago",
  "us/mountain": "America/Denver",
  "us/pacific": "America/Los_Angeles",
};

const extractTzid = (rawName: string): string | null => {
  const match = /;TZID=("?)([^";:]+)\1/i.exec(rawName);
  return match ? (match[2] ?? null) : null;
};

const resolveTimeZone = (tzid: string): string | null => {
  const key = tzid.trim().toLowerCase();
  if (key === "") return null;
  const aliased = TZID_ALIASES[key];
  if (aliased) return aliased;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tzid }).format(0);
    return tzid;
  } catch {
    return null;
  }
};

const zoneOffsetMillis = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return (
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) -
    instant.getTime()
  );
};

const toUtc = (wallClock: Date, timeZone: string): Date =>
  new Date(wallClock.getTime() - zoneOffsetMillis(wallClock, timeZone));

const parseIcsDate = (
  value: string,
  tzid: string | null = null,
): { date: Date; allDay: boolean } | null => {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return {
      date: new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))),
      allDay: true,
    };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(trimmed);
  if (!dateTime) return null;
  const wallClock = new Date(
    Date.UTC(
      Number(dateTime[1]),
      Number(dateTime[2]) - 1,
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
      Number(dateTime[6]),
    ),
  );
  if (dateTime[7] === "Z" || tzid === null) return { date: wallClock, allDay: false };
  const zone = resolveTimeZone(tzid);
  return { date: zone ? toUtc(wallClock, zone) : wallClock, allDay: false };
};

const isHighImpact = (title: string): boolean => {
  const lower = title.toLowerCase();
  return (
    lower.includes("consumer price index") ||
    lower.includes("cpi") ||
    lower.includes("employment situation")
  );
};

const buildEvent = (block: readonly string[], options: ParseOptions): EconomicEvent | null => {
  let summary = "";
  let dtstart = "";
  let dtstartName = "";
  let uid = "";
  for (const line of block) {
    const property = splitProperty(line);
    if (!property) continue;
    const name = propertyName(property.name);
    if (name === "SUMMARY") summary = unescapeIcsText(property.value).trim();
    else if (name === "DTSTART") {
      dtstart = property.value.trim();
      dtstartName = property.name;
    } else if (name === "UID") uid = property.value.trim();
  }
  if (summary === "" || dtstart === "") return null;
  const parsed = parseIcsDate(dtstart, extractTzid(dtstartName));
  if (!parsed) return null;

  return normalizeEvent({
    source: "bls",
    sourceEventId: uid !== "" ? uid : `${parsed.date.toISOString()}-${slugify(summary)}`,
    title: summary,
    country: "US",
    currency: "USD",
    category: "macro",
    impact: isHighImpact(summary) ? "high" : "medium",
    scheduledAt: parsed.date,
    allDay: parsed.allDay,
    sourceUrl: BLS_SOURCE_URL,
    attribution: BLS_ATTRIBUTION,
    fetchedAt: options.fetchedAt,
  });
};

export const parse = (body: string, options: ParseOptions = {}): readonly EconomicEvent[] => {
  if (typeof body !== "string" || body.trim() === "") return [];

  const events: EconomicEvent[] = [];
  let block: string[] | null = null;
  for (const line of unfold(body)) {
    const marker = line.trim().toUpperCase();
    if (marker === "BEGIN:VEVENT") {
      block = [];
      continue;
    }
    if (marker === "END:VEVENT") {
      if (block) {
        const event = buildEvent(block, options);
        if (event) events.push(event);
      }
      block = null;
      continue;
    }
    if (block) block.push(line);
  }
  return events;
};
