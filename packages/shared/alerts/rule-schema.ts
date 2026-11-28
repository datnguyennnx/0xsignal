export type Severity = "info" | "warn" | "critical";
export type Target = "inapp" | "telegram";

export type RuleBase = {
  v: 1;
  name: string;
  for_seconds: number;
  cooldown_seconds: number;
  once?: boolean;
  targets: Target[];
  severity: Severity;
  summary: string;
  enabled: boolean;
  expires_at?: string | null;
};

export type Rule =
  | (RuleBase & {
      kind: "price";
      condition: { subject: `price:${string}`; op: "gte" | "lte" | "cross"; value: number };
    })
  | (RuleBase & {
      kind: "calendar";
      condition: {
        subject: `calendar:${string}`;
        impactMin: "medium" | "high";
        leadMinutes: number;
      };
    })
  | (RuleBase & {
      kind: "liq_proximity";
      condition: { subject: `liq:${string}`; thresholds: number[] };
    });

export type Sample =
  | { kind: "price"; value: number }
  | { kind: "calendar"; scheduledAt: number; impact: "low" | "medium" | "high"; currency: string }
  | { kind: "liq"; markPrice: number; liquidationPx: number; side: "long" | "short" };

export type RuleState = {
  phase: "idle" | "pending" | "cooldown" | "done";
  since: number | null;
  until: number | null;
  last: number | null;
  fired: number;
};

export type Notice = {
  ruleName: string;
  severity: Severity;
  summary: string;
  firedAt: number;
  payload: Record<string, unknown>;
};

export class RuleValidationError extends Error {
  readonly code = "RULE_INVALID";
  readonly path: string;

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = "RuleValidationError";
    this.path = path;
  }
}

const RULE_KINDS = ["price", "calendar", "liq_proximity"] as const;
const PRICE_OPS = ["gte", "lte", "cross"] as const;
const IMPACT_MINIMUMS = ["medium", "high"] as const;
const SEVERITIES = ["info", "warn", "critical"] as const;
const TARGETS = ["inapp", "telegram"] as const;

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, detail: string): never {
  throw new RuleValidationError(path, detail);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  return fail(path, `expected one of ${allowed.join(", ")}`);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "expected a string");
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "expected a non-empty string");
  return value.trim();
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a finite number");
  return value;
}

function requireNonNegativeNumber(value: unknown, path: string): number {
  const parsed = requireFiniteNumber(value, path);
  if (parsed < 0) fail(path, "expected a non-negative number");
  return parsed;
}

function isPrefixedSubject<P extends string>(value: unknown, prefix: P): value is `${P}${string}` {
  return typeof value === "string" && value.startsWith(prefix) && value.length > prefix.length;
}

function requirePrefixedSubject<P extends string>(
  value: unknown,
  prefix: P,
  path: string,
): `${P}${string}` {
  if (!isPrefixedSubject(value, prefix)) {
    return fail(path, `expected a string starting with "${prefix}"`);
  }
  return value;
}

function requireTargets(value: unknown, path: string): Target[] {
  if (!Array.isArray(value)) fail(path, "expected an array of targets");
  return value.map((target, index) => oneOf(target, TARGETS, `${path}[${index}]`));
}

function requireThresholds(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || value.length === 0)
    fail(path, "expected a non-empty array of numbers");
  return value.map((threshold, index) => requireFiniteNumber(threshold, `${path}[${index}]`));
}

function parseExpiresAt(value: unknown, path: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !ISO_8601.test(value) || Number.isNaN(Date.parse(value))) {
    fail(path, "expected an ISO 8601 timestamp or null");
  }
  return value;
}

export function parseRule(input: unknown): Rule {
  if (!isRecord(input)) fail("$", "expected a rule object");
  if (input["v"] !== 1) fail("$.v", "expected 1");

  const kind = oneOf(input["kind"], RULE_KINDS, "$.kind");
  const name = requireNonEmptyString(input["name"], "$.name");
  const forSeconds = requireNonNegativeNumber(input["for_seconds"], "$.for_seconds");
  const cooldownSeconds = requireNonNegativeNumber(input["cooldown_seconds"], "$.cooldown_seconds");
  const once = input["once"] === undefined ? false : requireBoolean(input["once"], "$.once");
  const targets = requireTargets(input["targets"], "$.targets");
  const severity = oneOf(input["severity"], SEVERITIES, "$.severity");
  const summary = requireString(input["summary"], "$.summary");
  const enabled = requireBoolean(input["enabled"], "$.enabled");
  const expiresAt = parseExpiresAt(input["expires_at"], "$.expires_at");

  const base = {
    v: 1 as const,
    name,
    for_seconds: forSeconds,
    cooldown_seconds: cooldownSeconds,
    once,
    targets,
    severity,
    summary,
    enabled,
    ...(expiresAt === undefined ? {} : { expires_at: expiresAt }),
  };

  const condition = input["condition"];
  if (!isRecord(condition)) fail("$.condition", "expected a condition object");

  switch (kind) {
    case "price": {
      return {
        ...base,
        kind,
        condition: {
          subject: requirePrefixedSubject(condition["subject"], "price:", "$.condition.subject"),
          op: oneOf(condition["op"], PRICE_OPS, "$.condition.op"),
          value: requireFiniteNumber(condition["value"], "$.condition.value"),
        },
      };
    }
    case "calendar": {
      return {
        ...base,
        kind,
        condition: {
          subject: requirePrefixedSubject(condition["subject"], "calendar:", "$.condition.subject"),
          impactMin: oneOf(condition["impactMin"], IMPACT_MINIMUMS, "$.condition.impactMin"),
          leadMinutes: requireNonNegativeNumber(
            condition["leadMinutes"],
            "$.condition.leadMinutes",
          ),
        },
      };
    }
    case "liq_proximity": {
      return {
        ...base,
        kind,
        condition: {
          subject: requirePrefixedSubject(condition["subject"], "liq:", "$.condition.subject"),
          thresholds: requireThresholds(condition["thresholds"], "$.condition.thresholds"),
        },
      };
    }
    default:
      return fail("$.kind", "unsupported rule kind");
  }
}

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (isRecord(value)) {
    const body = Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function fnv1a64Hex(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export function ruleSignature(rule: Rule): string {
  return fnv1a64Hex(canonicalJson({ kind: rule.kind, condition: rule.condition }));
}
