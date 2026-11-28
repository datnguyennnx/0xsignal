import type { Notice, Rule, RuleState, Sample } from "./rule-schema";

type Result = { state: RuleState; fire: Notice | null };

type Outcome = {
  isTrue: boolean;
  instant: boolean;
  last: number | null;
  mark: number | null;
  payload: Record<string, unknown>;
};

type PriceRule = Extract<Rule, { kind: "price" }>;
type CalendarRule = Extract<Rule, { kind: "calendar" }>;
type LiqRule = Extract<Rule, { kind: "liq_proximity" }>;

const IMPACT_RANK: Record<"low" | "medium" | "high", number> = { low: 0, medium: 1, high: 2 };

export function initialState(): RuleState {
  return { phase: "idle", since: null, until: null, last: null, fired: 0 };
}

export function evaluate(rule: Rule, sample: Sample, now: number, state: RuleState): Result {
  if (!rule.enabled) return { state, fire: null };
  if (hasExpired(rule, now)) return { state: initialState(), fire: null };
  if (state.phase === "done") return { state, fire: null };

  const active = leaveCooldown(state, now);
  if (active.phase === "cooldown") return { state: active, fire: null };

  switch (rule.kind) {
    case "price":
      if (sample.kind !== "price") return { state, fire: null };
      return settle(rule, now, active, priceOutcome(rule, sample, active));
    case "calendar":
      if (sample.kind !== "calendar") return { state, fire: null };
      return settle(rule, now, active, calendarOutcome(rule, sample, now, active));
    case "liq_proximity": {
      if (sample.kind !== "liq") return { state, fire: null };
      const outcome = liqOutcome(rule, sample, active);
      if (outcome === null) return { state, fire: null };
      return settle(rule, now, active, outcome);
    }
    default:
      return { state, fire: null };
  }
}

function hasExpired(rule: Rule, now: number): boolean {
  if (rule.expires_at === undefined || rule.expires_at === null) return false;
  const expiresAt = Date.parse(rule.expires_at);
  return Number.isFinite(expiresAt) && now >= expiresAt;
}

function leaveCooldown(state: RuleState, now: number): RuleState {
  if (state.phase !== "cooldown" || state.until === null || now < state.until) return state;
  return { ...state, phase: "idle", since: null, until: null };
}

function settle(rule: Rule, now: number, state: RuleState, outcome: Outcome): Result {
  if (!outcome.isTrue) {
    return {
      state: { ...state, phase: "idle", since: null, until: null, last: outcome.last },
      fire: null,
    };
  }
  if (outcome.instant || rule.for_seconds === 0) return fire(rule, now, state, outcome);

  const since = state.phase === "pending" && state.since !== null ? state.since : now;
  if (now - since >= rule.for_seconds * 1000) return fire(rule, now, state, outcome);

  return {
    state: { ...state, phase: "pending", since, until: null, last: outcome.last },
    fire: null,
  };
}

function fire(rule: Rule, now: number, state: RuleState, outcome: Outcome): Result {
  const { phase, until } = nextPhase(rule, now);
  return {
    state: {
      phase,
      since: null,
      until,
      last: outcome.mark ?? outcome.last,
      fired: state.fired + 1,
    },
    fire: {
      ruleName: rule.name,
      severity: rule.severity,
      summary: rule.summary,
      firedAt: now,
      payload: outcome.payload,
    },
  };
}

function nextPhase(rule: Rule, now: number): Pick<RuleState, "phase" | "until"> {
  if (rule.once === true) return { phase: "done", until: null };
  if (rule.cooldown_seconds > 0)
    return { phase: "cooldown", until: now + rule.cooldown_seconds * 1000 };
  return { phase: "idle", until: null };
}

function priceOutcome(
  rule: PriceRule,
  sample: Extract<Sample, { kind: "price" }>,
  state: RuleState,
): Outcome {
  const { subject, op, value } = rule.condition;
  const payload = { kind: rule.kind, subject, op, value, sample: sample.value };

  if (op === "cross") {
    const crossed = state.last !== null && state.last < value && sample.value >= value;
    return {
      isTrue: crossed,
      instant: true,
      last: sample.value,
      mark: sample.value,
      payload: { ...payload, previous: state.last },
    };
  }

  return {
    isTrue: op === "gte" ? sample.value >= value : sample.value <= value,
    instant: false,
    last: state.last,
    mark: null,
    payload,
  };
}

function calendarOutcome(
  rule: CalendarRule,
  sample: Extract<Sample, { kind: "calendar" }>,
  now: number,
  state: RuleState,
): Outcome {
  const { subject, impactMin, leadMinutes } = rule.condition;
  const inWindow = sample.scheduledAt - leadMinutes * 60_000 <= now && now < sample.scheduledAt;
  const impactSufficient = IMPACT_RANK[sample.impact] >= IMPACT_RANK[impactMin];
  const isTrue = inWindow && impactSufficient && state.last !== sample.scheduledAt;

  return {
    isTrue,
    instant: false,
    last: state.last,
    mark: isTrue ? sample.scheduledAt : null,
    payload: {
      kind: rule.kind,
      subject,
      scheduledAt: sample.scheduledAt,
      impact: sample.impact,
      currency: sample.currency,
      leadMinutes,
    },
  };
}

function liqOutcome(
  rule: LiqRule,
  sample: Extract<Sample, { kind: "liq" }>,
  state: RuleState,
): Outcome | null {
  if (!Number.isFinite(sample.markPrice) || sample.markPrice === 0) return null;

  const { subject, thresholds } = rule.condition;
  const distance =
    sample.side === "long"
      ? ((sample.markPrice - sample.liquidationPx) / sample.markPrice) * 100
      : ((sample.liquidationPx - sample.markPrice) / sample.markPrice) * 100;

  const previous = state.last;
  const crossed =
    previous === null
      ? []
      : thresholds.filter((threshold) => previous > threshold && distance <= threshold);
  const threshold = crossed.length === 0 ? null : Math.min(...crossed);

  return {
    isTrue: threshold !== null,
    instant: true,
    last: distance,
    mark: distance,
    payload: {
      kind: rule.kind,
      subject,
      side: sample.side,
      markPrice: sample.markPrice,
      liquidationPx: sample.liquidationPx,
      distance,
      threshold,
      thresholdsCrossed: crossed,
    },
  };
}
