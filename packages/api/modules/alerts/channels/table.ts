import type { SubjectType } from "../table";

export type ChannelName = "telegram";

export interface ChannelRow {
  readonly id: string;
  readonly channel: ChannelName;
  readonly destination: string;
  readonly label: string | null;
  readonly verifiedAt: string | null;
  readonly lastError: string | null;
  readonly lastSentAt: string | null;
}

export interface ChannelDbRow {
  [column: string]: unknown;
  id: string;
  channel: string;
  destination: string;
  label: string | null;
  verified_at: Date | string | null;
  last_error: string | null;
  last_sent_at: Date | string | null;
}

export interface ChannelSubjectDbRow extends ChannelDbRow {
  subject_type: string;
  subject_id: string;
}

export interface SubjectChannelRow {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly channel: ChannelRow;
}

export interface LinkCodeDbRow {
  [column: string]: unknown;
  subject_type: string;
  subject_id: string;
  channel: string;
}

export interface ConsumedLinkRow {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly channel: ChannelName;
}

const CHANNEL_COLUMNS = "id, channel, destination, label, verified_at, last_error, last_sent_at";

const SUBJECT_CHANNEL_COLUMNS =
  "subject_type, subject_id, id, channel, destination, label, verified_at, last_error, last_sent_at";

export const INSERT_LINK_CODE_SQL = `
INSERT INTO alert_link_codes (code, subject_type, subject_id, channel, expires_at)
VALUES ($1, $2::alert_subject, $3, $4, to_timestamp($5::bigint / 1000.0))`;

export const CONSUME_LINK_CODE_SQL = `
UPDATE alert_link_codes
SET consumed_at = to_timestamp($2::bigint / 1000.0)
WHERE code = $1
  AND consumed_at IS NULL
  AND expires_at > to_timestamp($2::bigint / 1000.0)
RETURNING subject_type, subject_id, channel`;

export const UPSERT_CHANNEL_SQL = `
INSERT INTO alert_channels (id, subject_type, subject_id, channel, destination, label, verified_at)
VALUES (gen_random_uuid(), $1::alert_subject, $2, $3, $4, $5, to_timestamp($6::bigint / 1000.0))
ON CONFLICT (channel, destination) DO UPDATE SET
  subject_type = excluded.subject_type,
  subject_id = excluded.subject_id,
  label = excluded.label,
  verified_at = excluded.verified_at
RETURNING ${CHANNEL_COLUMNS}`;

export const LIST_CHANNELS_BY_SUBJECT_SQL = `
SELECT ${CHANNEL_COLUMNS}
FROM alert_channels
WHERE subject_type = $1::alert_subject AND subject_id = $2
ORDER BY created_at ASC, id ASC`;

export const DELETE_CHANNEL_BY_ID_AND_SUBJECT_SQL = `
DELETE FROM alert_channels
WHERE id = $1::uuid AND subject_type = $2::alert_subject AND subject_id = $3`;

export const COUNT_CHANNELS_BY_SUBJECT_SQL = `
SELECT COUNT(*)::int AS count
FROM alert_channels
WHERE subject_type = $1::alert_subject AND subject_id = $2`;

export const TOUCH_CHANNEL_SENT_SQL = `
UPDATE alert_channels
SET last_sent_at = now(), last_error = NULL
WHERE id = $1::uuid`;

export const TOUCH_CHANNEL_ERROR_SQL = `
UPDATE alert_channels
SET last_error = $2
WHERE id = $1::uuid`;

// Pairs the arrays element-wise so a subject tuple cannot match across subjects.
export const SELECT_CHANNELS_FOR_SUBJECTS_SQL = `
SELECT ${SUBJECT_CHANNEL_COLUMNS}
FROM alert_channels
WHERE (subject_type::text, subject_id) IN (
  SELECT pair.type, pair.id FROM unnest($1::text[], $2::text[]) AS pair(type, id)
)
ORDER BY subject_type, subject_id, created_at ASC, id ASC`;

export function toChannelRow(row: ChannelDbRow): ChannelRow {
  return {
    id: row.id,
    channel: toChannelName(row.channel),
    destination: row.destination,
    label: row.label,
    verifiedAt: toIsoString(row.verified_at),
    lastError: row.last_error,
    lastSentAt: toIsoString(row.last_sent_at),
  };
}

export function toSubjectChannelRow(row: ChannelSubjectDbRow): SubjectChannelRow {
  return {
    subjectType: toSubjectType(row.subject_type),
    subjectId: row.subject_id,
    channel: toChannelRow(row),
  };
}

export function toConsumedLinkRow(row: LinkCodeDbRow): ConsumedLinkRow {
  return {
    subjectType: toSubjectType(row.subject_type),
    subjectId: row.subject_id,
    channel: toChannelName(row.channel),
  };
}

function toChannelName(value: string): ChannelName {
  if (value === "telegram") return value;
  throw new Error(`unsupported alert channel: ${value}`);
}

function toSubjectType(value: string): SubjectType {
  if (value === "user" || value === "device") return value;
  throw new Error(`unsupported alert subject type: ${value}`);
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
