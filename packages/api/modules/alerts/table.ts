import { parseRule, type Rule, type Sample } from "@0xsignal/shared/alerts";

export type SubjectType = "user" | "device";

export type Subject =
  | { readonly type: "user"; readonly id: string }
  | { readonly type: "device"; readonly id: string };

export interface AlertRuleRow {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  rule: Rule;
  signature: string;
  createdAt: string;
}

export interface AlertRuleDbRow {
  [column: string]: unknown;
  id: string;
  subject_type: string;
  subject_id: string;
  params: unknown;
  signature: string;
  created_at: Date | string;
}

export interface AlertDeliveryDbRow {
  [column: string]: unknown;
  id: string;
  rule_id: string;
  fired_at: Date | string;
  params: unknown;
  payload: unknown;
}

export interface DeliveryRow {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Rule["severity"];
  readonly summary: string;
  readonly firedAt: string;
  readonly payload: Record<string, unknown>;
}

const RULE_COLUMNS = "id, subject_type, subject_id, params, signature, created_at";

// The migrated columns cannot carry every Rule field (v, severity, summary), so
// `params` stores the whole validated rule and is the only source read back.
export const LIST_RULES_SQL = `
SELECT ${RULE_COLUMNS}
FROM alert_rules
WHERE subject_type = $1::alert_subject AND subject_id = $2
ORDER BY created_at DESC, id ASC
LIMIT $3`;

export const FIND_RULE_BY_ID_SQL = `
SELECT ${RULE_COLUMNS}
FROM alert_rules
WHERE id = $1::uuid AND subject_type = $2::alert_subject AND subject_id = $3`;

export const FIND_RULE_BY_SIGNATURE_SQL = `
SELECT ${RULE_COLUMNS}
FROM alert_rules
WHERE subject_type = $1::alert_subject AND subject_id = $2 AND signature = $3`;

export const INSERT_RULE_SQL = `
INSERT INTO alert_rules (
  id, subject_type, subject_id, name, kind, condition, params, signature,
  enabled, targets, for_seconds, cooldown_seconds, expires_at, created_at
) VALUES (
  $1::uuid, $2::alert_subject, $3, $4, $5, $6::jsonb, $7::jsonb, $8,
  $9, $10::text[], $11, $12, $13::timestamptz, $14::timestamptz
)
ON CONFLICT (subject_type, subject_id, signature) DO NOTHING
RETURNING ${RULE_COLUMNS}`;

export const UPDATE_RULE_ENABLED_SQL = `
UPDATE alert_rules
SET enabled = $1, params = jsonb_set(params, '{enabled}', to_jsonb($1::boolean))
WHERE id = $2::uuid AND subject_type = $3::alert_subject AND subject_id = $4
RETURNING ${RULE_COLUMNS}`;

export const DELETE_RULE_SQL = `
DELETE FROM alert_rules
WHERE id = $1::uuid AND subject_type = $2::alert_subject AND subject_id = $3`;

export const COUNT_RULES_SQL = `
SELECT COUNT(*)::int AS count
FROM alert_rules
WHERE subject_type = $1::alert_subject AND subject_id = $2`;

export const COUNT_DELIVERIES_SINCE_BY_SUBJECT = `
SELECT COUNT(*)::int AS count
FROM alert_deliveries AS d
JOIN alert_rules AS r ON r.id = d.rule_id
WHERE r.subject_type = $1::alert_subject
  AND r.subject_id = $2
  AND d.fired_at >= to_timestamp($3::bigint / 1000.0)`;

export const LIST_ALL_ENABLED_RULES_SQL = `
SELECT ${RULE_COLUMNS}
FROM alert_rules
WHERE enabled = TRUE
ORDER BY created_at ASC, id ASC`;

export const CALENDAR_EVENTS_IN_WINDOW_SQL = `
SELECT currency, impact, scheduled_at
FROM economic_events
WHERE scheduled_at >= to_timestamp($1::bigint / 1000.0)
  AND scheduled_at <= to_timestamp($2::bigint / 1000.0)
  AND currency IS NOT NULL
ORDER BY scheduled_at ASC`;

export const INSERT_DELIVERY_SQL = `
INSERT INTO alert_deliveries (rule_id, bucket, fired_at, payload)
VALUES ($1::uuid, $2, to_timestamp($3::bigint / 1000.0), $4::jsonb)
ON CONFLICT (rule_id, bucket) DO NOTHING
RETURNING id`;

export const LIST_DELIVERIES_SQL = `
SELECT d.id, d.rule_id, d.fired_at, d.payload, r.params
FROM alert_deliveries AS d
JOIN alert_rules AS r ON r.id = d.rule_id
WHERE r.subject_type = $1::alert_subject AND r.subject_id = $2
ORDER BY d.fired_at DESC, d.id DESC
LIMIT $3`;

export const COUNT_UNREAD_DELIVERIES_SQL = `
SELECT COUNT(*)::int AS count
FROM alert_deliveries AS d
JOIN alert_rules AS r ON r.id = d.rule_id
LEFT JOIN alert_read_state AS rs
  ON rs.subject_type = r.subject_type AND rs.subject_id = r.subject_id
WHERE r.subject_type = $1::alert_subject
  AND r.subject_id = $2
  AND d.fired_at > COALESCE(rs.last_seen_at, 'epoch'::timestamptz)`;

export const MARK_DELIVERIES_SEEN_SQL = `
INSERT INTO alert_read_state (subject_type, subject_id, last_seen_at)
VALUES ($1::alert_subject, $2, to_timestamp($3::bigint / 1000.0))
ON CONFLICT (subject_type, subject_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`;

export const SWEEP_DELIVERIES_SQL = `
DELETE FROM alert_deliveries
WHERE fired_at < to_timestamp($1::bigint / 1000.0)`;

export const TOUCH_ALERT_SUBSCRIPTION_SQL = `
INSERT INTO alert_subscriptions (device_id, last_seen_at)
VALUES ($1, now())
ON CONFLICT (device_id) DO UPDATE SET last_seen_at = now()`;

type CalendarImpact = Extract<Sample, { kind: "calendar" }>["impact"];

export interface CalendarEventDbRow {
  [column: string]: unknown;
  currency: string | null;
  impact: string;
  scheduled_at: Date | string;
}

export interface AlertCalendarEvent {
  readonly scheduledAt: number;
  readonly impact: CalendarImpact;
  readonly currency: string;
}

const CALENDAR_IMPACTS: readonly CalendarImpact[] = ["low", "medium", "high"];

const isCalendarImpact = (value: string): value is CalendarImpact =>
  CALENDAR_IMPACTS.some((impact) => impact === value);

export function toAlertCalendarEvent(row: CalendarEventDbRow): AlertCalendarEvent | null {
  if (row.currency === null || !isCalendarImpact(row.impact)) return null;

  const scheduledAt =
    row.scheduled_at instanceof Date ? row.scheduled_at.getTime() : Date.parse(row.scheduled_at);
  if (!Number.isFinite(scheduledAt)) return null;

  return {
    scheduledAt,
    impact: row.impact,
    currency: row.currency,
  };
}

export const subjectKey = (subject: { readonly type: SubjectType; readonly id: string }): string =>
  `${subject.type}:${subject.id}`;

export function toAlertRuleRow(row: AlertRuleDbRow): AlertRuleRow {
  return {
    id: row.id,
    subjectType: toSubjectType(row.subject_type),
    subjectId: row.subject_id,
    rule: parseRule(row.params),
    signature: row.signature,
    createdAt: toIsoString(row.created_at),
  };
}

export function toDeliveryRow(row: AlertDeliveryDbRow): DeliveryRow {
  const rule = parseRule(row.params);
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: rule.name,
    severity: rule.severity,
    summary: rule.summary,
    firedAt: toIsoString(row.fired_at),
    payload: toPayloadRecord(row.payload),
  };
}

function toPayloadRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }
  return {};
}

function toSubjectType(value: string): SubjectType {
  if (value === "user" || value === "device") return value;
  throw new Error(`unsupported alert subject type: ${value}`);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
