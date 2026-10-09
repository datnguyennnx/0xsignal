import { Effect } from "effect";
import type { EconomicEvent } from "@0xsignal/shared";
import { CalendarRepoError, type CalendarRepoPort } from "./calendar.repo";

const UPSERT_SQL = `
INSERT INTO economic_events (
  id, source, source_event_id, title, country, currency, category, impact,
  scheduled_at, all_day, period, forecast, previous, actual, revised,
  source_url, attribution, fetched_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
ON CONFLICT (source, source_event_id) DO UPDATE SET
  title = EXCLUDED.title,
  country = EXCLUDED.country,
  currency = EXCLUDED.currency,
  category = EXCLUDED.category,
  impact = EXCLUDED.impact,
  scheduled_at = EXCLUDED.scheduled_at,
  all_day = EXCLUDED.all_day,
  period = EXCLUDED.period,
  forecast = EXCLUDED.forecast,
  previous = EXCLUDED.previous,
  actual = EXCLUDED.actual,
  revised = EXCLUDED.revised,
  source_url = EXCLUDED.source_url,
  attribution = EXCLUDED.attribution,
  fetched_at = EXCLUDED.fetched_at`;

const UPCOMING_SQL = `
SELECT * FROM economic_events
WHERE scheduled_at >= now() AND scheduled_at <= now() + make_interval(hours => $1::int)
ORDER BY scheduled_at ASC`;

const DEFAULT_QUERY_LIMIT = 500;

export function pgCalendarRepo(pg: NonNullable<import("pg").Pool>): CalendarRepoPort {
  return {
    upsertMany: (events) =>
      Effect.tryPromise({
        try: async () => {
          let upserted = 0;
          for (const event of events) {
            await pg.query(UPSERT_SQL, [
              event.id,
              event.source,
              event.sourceEventId,
              event.title,
              event.country,
              event.currency,
              event.category,
              event.impact,
              event.scheduledAt,
              event.allDay,
              event.period,
              event.forecast,
              event.previous,
              event.actual,
              event.revised,
              event.sourceUrl,
              event.attribution,
              event.fetchedAt,
            ]);
            upserted += 1;
          }
          return upserted;
        },
        catch: (cause) =>
          new CalendarRepoError({ message: "Failed to upsert economic events", cause }),
      }),

    query: (q) =>
      Effect.tryPromise({
        try: async () => {
          const conditions: string[] = [];
          const params: unknown[] = [];
          const bind = (value: unknown): string => {
            params.push(value);
            return `$${params.length}`;
          };

          if (q.from !== undefined) conditions.push(`scheduled_at >= ${bind(q.from)}`);
          if (q.to !== undefined) conditions.push(`scheduled_at <= ${bind(q.to)}`);
          if (q.impact !== undefined && q.impact.length > 0) {
            conditions.push(`impact = ANY(${bind(q.impact)})`);
          }
          if (q.currency !== undefined && q.currency.length > 0) {
            conditions.push(`currency = ANY(${bind(q.currency)})`);
          }
          if (q.category !== undefined && q.category.length > 0) {
            conditions.push(`category = ANY(${bind(q.category)})`);
          }

          const limit = bind(q.limit ?? DEFAULT_QUERY_LIMIT);
          const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
          const sql = `SELECT * FROM economic_events${where} ORDER BY scheduled_at ASC LIMIT ${limit}`;

          const result = await pg.query(sql, params);
          return result.rows.map(mapRow);
        },
        catch: (cause) =>
          new CalendarRepoError({ message: "Failed to query economic events", cause }),
      }),

    upcoming: (hours) =>
      Effect.tryPromise({
        try: async () => {
          const result = await pg.query(UPCOMING_SQL, [hours]);
          return result.rows.map(mapRow);
        },
        catch: (cause) =>
          new CalendarRepoError({ message: "Failed to load upcoming economic events", cause }),
      }),
  };
}

interface EconomicEventRow {
  id: string;
  source: EconomicEvent["source"];
  source_event_id: string;
  title: string;
  country: string;
  currency: string | null;
  category: EconomicEvent["category"];
  impact: EconomicEvent["impact"];
  scheduled_at: Date | string;
  all_day: boolean;
  period: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  revised: string | null;
  source_url: string | null;
  attribution: string;
  fetched_at: Date | string;
}

function mapRow(row: EconomicEventRow): EconomicEvent {
  return {
    id: row.id,
    source: row.source,
    sourceEventId: row.source_event_id,
    title: row.title,
    country: row.country,
    currency: row.currency ?? null,
    category: row.category,
    impact: row.impact,
    scheduledAt: toIsoString(row.scheduled_at),
    allDay: Boolean(row.all_day),
    period: row.period ?? null,
    forecast: row.forecast ?? null,
    previous: row.previous ?? null,
    actual: row.actual ?? null,
    revised: row.revised ?? null,
    sourceUrl: row.source_url ?? null,
    attribution: row.attribution,
    fetchedAt: toIsoString(row.fetched_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
