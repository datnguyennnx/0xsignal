/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { evaluate, initialState } from "./engine";
import { parseRule, RuleValidationError, ruleSignature, type Rule } from "./rule-schema";

const T0 = 1_700_000_000_000;

type PriceRule = Extract<Rule, { kind: "price" }>;
type CalendarRule = Extract<Rule, { kind: "calendar" }>;
type LiqRule = Extract<Rule, { kind: "liq_proximity" }>;

type Overrides = {
  for_seconds?: number;
  cooldown_seconds?: number;
  once?: boolean;
  enabled?: boolean;
  expires_at?: string;
};

function priceRule(condition: PriceRule["condition"], overrides: Overrides = {}): PriceRule {
  return {
    v: 1,
    kind: "price",
    name: "BTC breakout",
    for_seconds: 0,
    cooldown_seconds: 0,
    targets: ["inapp"],
    severity: "warn",
    summary: "BTC crossed the level",
    enabled: true,
    ...overrides,
    condition,
  };
}

function calendarRule(
  condition: CalendarRule["condition"],
  overrides: Overrides = {},
): CalendarRule {
  return {
    v: 1,
    kind: "calendar",
    name: "NFP window",
    for_seconds: 0,
    cooldown_seconds: 0,
    targets: ["telegram"],
    severity: "critical",
    summary: "High-impact event approaching",
    enabled: true,
    ...overrides,
    condition,
  };
}

function liqRule(condition: LiqRule["condition"], overrides: Overrides = {}): LiqRule {
  return {
    v: 1,
    kind: "liq_proximity",
    name: "Liq proximity",
    for_seconds: 0,
    cooldown_seconds: 0,
    targets: ["inapp"],
    severity: "critical",
    summary: "Price near liquidation",
    enabled: true,
    ...overrides,
    condition,
  };
}

describe("price sustain", () => {
  test("moves idle to pending on the first true sample", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { for_seconds: 60 });
    const step = evaluate(rule, { kind: "price", value: 101 }, T0, initialState());
    expect(step.fire).toBeNull();
    expect(step.state).toMatchObject({ phase: "pending", since: T0, fired: 0 });
  });

  test("stays pending before the sustain window elapses", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { for_seconds: 60 });
    const pending = evaluate(rule, { kind: "price", value: 101 }, T0, initialState()).state;
    const early = evaluate(rule, { kind: "price", value: 101 }, T0 + 59_999, pending);
    expect(early.fire).toBeNull();
    expect(early.state.phase).toBe("pending");
    expect(early.state.since).toBe(T0);
  });

  test("fires exactly at the sustain boundary", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { for_seconds: 60 });
    const pending = evaluate(rule, { kind: "price", value: 101 }, T0, initialState()).state;
    const fired = evaluate(rule, { kind: "price", value: 101 }, T0 + 60_000, pending);
    expect(fired.fire?.ruleName).toBe("BTC breakout");
    expect(fired.state).toMatchObject({ phase: "idle", since: null, last: null, fired: 1 });
  });

  test("resets pending when a false sample arrives", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { for_seconds: 60 });
    const pending = evaluate(rule, { kind: "price", value: 101 }, T0, initialState()).state;
    const reset = evaluate(rule, { kind: "price", value: 99 }, T0 + 30_000, pending);
    expect(reset.fire).toBeNull();
    expect(reset.state).toMatchObject({ phase: "idle", since: null });

    const restarted = evaluate(rule, { kind: "price", value: 101 }, T0 + 45_000, reset.state);
    expect(restarted.fire).toBeNull();
    expect(restarted.state).toMatchObject({ phase: "pending", since: T0 + 45_000 });
  });

  test("fires immediately when for_seconds is zero", () => {
    const rule = priceRule({ subject: "price:BTC", op: "lte", value: 100 });
    const fired = evaluate(rule, { kind: "price", value: 100 }, T0, initialState());
    expect(fired.fire).not.toBeNull();
    expect(fired.state.fired).toBe(1);
  });
});

describe("cooldown", () => {
  test("suppresses true samples during cooldown", () => {
    const rule = priceRule(
      { subject: "price:BTC", op: "gte", value: 100 },
      { cooldown_seconds: 300 },
    );
    const fired = evaluate(rule, { kind: "price", value: 101 }, T0, initialState());
    expect(fired.state.phase).toBe("cooldown");
    expect(fired.state.until).toBe(T0 + 300_000);

    const suppressed = evaluate(rule, { kind: "price", value: 101 }, T0 + 299_999, fired.state);
    expect(suppressed.fire).toBeNull();
    expect(suppressed.state).toBe(fired.state);
  });

  test("fires again once cooldown elapses", () => {
    const rule = priceRule(
      { subject: "price:BTC", op: "gte", value: 100 },
      { cooldown_seconds: 300 },
    );
    const fired = evaluate(rule, { kind: "price", value: 101 }, T0, initialState());
    const again = evaluate(rule, { kind: "price", value: 101 }, T0 + 300_000, fired.state);
    expect(again.fire).not.toBeNull();
    expect(again.state).toMatchObject({ phase: "cooldown", fired: 2 });
  });
});

describe("once", () => {
  test("fires a true level condition exactly once across five ticks", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { once: true });
    let state = initialState();
    let fires = 0;
    for (let tick = 0; tick < 5; tick += 1) {
      const step = evaluate(rule, { kind: "price", value: 101 }, T0 + tick * 1_000, state);
      state = step.state;
      if (step.fire !== null) fires += 1;
    }
    expect(fires).toBe(1);
    expect(state).toMatchObject({ phase: "done", fired: 1 });
  });

  test("stays done even after a false sample", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { once: true });
    const fired = evaluate(rule, { kind: "price", value: 101 }, T0, initialState());
    expect(fired.state.phase).toBe("done");

    const falseSample = evaluate(rule, { kind: "price", value: 99 }, T0 + 1_000, fired.state);
    expect(falseSample.fire).toBeNull();
    expect(falseSample.state.phase).toBe("done");

    const trueAgain = evaluate(rule, { kind: "price", value: 101 }, T0 + 2_000, falseSample.state);
    expect(trueAgain.fire).toBeNull();
    expect(trueAgain.state.fired).toBe(1);
  });

  test("absent once keeps cooldown repetition", () => {
    const rule = priceRule(
      { subject: "price:BTC", op: "gte", value: 100 },
      { cooldown_seconds: 600 },
    );
    let state = initialState();
    let fires = 0;
    for (let tick = 0; tick < 5; tick += 1) {
      const step = evaluate(rule, { kind: "price", value: 101 }, T0 + tick * 1_000, state);
      state = step.state;
      if (step.fire !== null) fires += 1;
    }
    expect(fires).toBe(1);
    expect(state.phase).toBe("cooldown");

    const afterCooldown = evaluate(rule, { kind: "price", value: 101 }, T0 + 600_000, state);
    expect(afterCooldown.fire).not.toBeNull();
    expect(afterCooldown.state.fired).toBe(2);
  });
});

describe("price cross", () => {
  test("records the first sample without firing", () => {
    const rule = priceRule({ subject: "price:ETH", op: "cross", value: 100 });
    const first = evaluate(rule, { kind: "price", value: 99 }, T0, initialState());
    expect(first.fire).toBeNull();
    expect(first.state.last).toBe(99);
  });

  test("fires on an upward crossing and then stays quiet", () => {
    const rule = priceRule({ subject: "price:ETH", op: "cross", value: 100 });
    const first = evaluate(rule, { kind: "price", value: 99 }, T0, initialState());
    const crossing = evaluate(rule, { kind: "price", value: 100.5 }, T0 + 1_000, first.state);
    expect(crossing.fire).not.toBeNull();
    expect(crossing.fire?.payload).toMatchObject({ subject: "price:ETH", previous: 99 });
    expect(crossing.state.last).toBe(100.5);

    const held = evaluate(rule, { kind: "price", value: 101 }, T0 + 2_000, crossing.state);
    expect(held.fire).toBeNull();
  });
});

describe("rule guards", () => {
  test("expired rules return idle with no fire", () => {
    const expiresAt = "2026-01-01T00:00:00.000Z";
    const now = Date.parse(expiresAt);
    const rule = priceRule(
      { subject: "price:BTC", op: "gte", value: 100 },
      { expires_at: expiresAt },
    );
    const step = evaluate(rule, { kind: "price", value: 200 }, now, initialState());
    expect(step.fire).toBeNull();
    expect(step.state.phase).toBe("idle");
  });

  test("disabled rules leave state untouched", () => {
    const rule = priceRule({ subject: "price:BTC", op: "gte", value: 100 }, { enabled: false });
    const state = initialState();
    const step = evaluate(rule, { kind: "price", value: 200 }, T0, state);
    expect(step.fire).toBeNull();
    expect(step.state).toBe(state);
  });

  test("wrong sample kind leaves state untouched", () => {
    const rule = calendarRule({ subject: "calendar:NFP", impactMin: "high", leadMinutes: 30 });
    const state = initialState();
    const step = evaluate(rule, { kind: "price", value: 200 }, T0, state);
    expect(step.fire).toBeNull();
    expect(step.state).toBe(state);
  });
});

describe("liq proximity", () => {
  test("fires once when distance crosses down through a threshold", () => {
    const rule = liqRule({ subject: "liq:ETH-USD", thresholds: [5] });
    const first = evaluate(
      rule,
      { kind: "liq", markPrice: 100, liquidationPx: 88, side: "long" },
      T0,
      initialState(),
    );
    expect(first.fire).toBeNull();
    expect(first.state.last).toBe(12);

    const crossing = evaluate(
      rule,
      { kind: "liq", markPrice: 100, liquidationPx: 96, side: "long" },
      T0 + 1_000,
      first.state,
    );
    expect(crossing.fire?.payload).toMatchObject({ threshold: 5, distance: 4 });
    expect(crossing.state.last).toBe(4);

    const repeat = evaluate(
      rule,
      { kind: "liq", markPrice: 100, liquidationPx: 96, side: "long" },
      T0 + 2_000,
      crossing.state,
    );
    expect(repeat.fire).toBeNull();
  });
});

describe("calendar lead window", () => {
  test("fires inside the lead window and only once per event", () => {
    const rule = calendarRule({ subject: "calendar:NFP", impactMin: "medium", leadMinutes: 30 });
    const scheduledAt = T0 + 3_600_000;
    const sample = { kind: "calendar", scheduledAt, impact: "high", currency: "USD" } as const;

    const outside = evaluate(rule, sample, scheduledAt - 31 * 60_000, initialState());
    expect(outside.fire).toBeNull();

    const inside = evaluate(rule, sample, scheduledAt - 30 * 60_000, outside.state);
    expect(inside.fire).not.toBeNull();
    expect(inside.state.last).toBe(scheduledAt);

    const held = evaluate(rule, sample, scheduledAt - 10 * 60_000, inside.state);
    expect(held.fire).toBeNull();
  });

  test("ignores impact below the configured minimum", () => {
    const rule = calendarRule({ subject: "calendar:NFP", impactMin: "high", leadMinutes: 30 });
    const scheduledAt = T0 + 3_600_000;
    const step = evaluate(
      rule,
      { kind: "calendar", scheduledAt, impact: "medium", currency: "USD" },
      scheduledAt - 60_000,
      initialState(),
    );
    expect(step.fire).toBeNull();
  });
});

describe("parseRule", () => {
  test("normalises a valid rule", () => {
    const rule = parseRule({
      v: 1,
      kind: "price",
      name: "  BTC  ",
      for_seconds: 30,
      cooldown_seconds: 0,
      targets: ["inapp", "telegram"],
      severity: "critical",
      summary: "BTC crossed",
      enabled: true,
      condition: { subject: "price:BTC", op: "cross", value: 100 },
    });
    expect(rule.name).toBe("BTC");
    expect(rule.condition).toEqual({ subject: "price:BTC", op: "cross", value: 100 });
  });

  test("accepts once as a boolean and rejects non-boolean values", () => {
    const input = {
      v: 1,
      kind: "price",
      name: "BTC",
      for_seconds: 0,
      cooldown_seconds: 0,
      targets: ["inapp"],
      severity: "warn",
      summary: "BTC crossed",
      enabled: true,
      condition: { subject: "price:BTC", op: "gte", value: 100 },
    };
    expect(parseRule({ ...input, once: true }).once).toBe(true);
    expect(parseRule(input).once).toBe(false);
    expect(() => parseRule({ ...input, once: "yes" })).toThrow(RuleValidationError);
  });

  test("throws a typed error on invalid input", () => {
    expect(() => parseRule({ v: 1, kind: "price" })).toThrow(RuleValidationError);
    expect(() =>
      parseRule({
        v: 1,
        kind: "calendar",
        name: "bad",
        for_seconds: 0,
        cooldown_seconds: 0,
        targets: ["inapp"],
        severity: "warn",
        summary: "s",
        enabled: true,
        condition: { subject: "price:BTC", impactMin: "high", leadMinutes: 30 },
      }),
    ).toThrow(RuleValidationError);
  });
});

describe("ruleSignature", () => {
  test("is canonical across key order and changes with the condition", () => {
    const ordered = priceRule({ subject: "price:BTC", op: "gte", value: 100 });
    const reordered = priceRule({ value: 100, op: "gte", subject: "price:BTC" });
    const changed = priceRule({ subject: "price:BTC", op: "gte", value: 101 });

    expect(ruleSignature(ordered)).toMatch(/^[0-9a-f]{16}$/);
    expect(ruleSignature(reordered)).toBe(ruleSignature(ordered));
    expect(ruleSignature(changed)).not.toBe(ruleSignature(ordered));
  });
});
