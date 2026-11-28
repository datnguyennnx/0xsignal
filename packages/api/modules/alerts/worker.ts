import { Clock, Context, Duration, Effect, Layer, Option } from "effect";
import {
  evaluate,
  initialState,
  type Notice,
  type Rule,
  type RuleState,
} from "@0xsignal/shared/alerts";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { HyperliquidProvider } from "../../integrations/hyperliquid/data-sources/types";
import { AlertsConfig, AlertsConfigLayer } from "./config";
import { createFanout, type Fanout, type FanoutDeps } from "./channels/fanout";
import { ChannelsService, ChannelsServiceWithInfra } from "./channels/service";
import { AlertsNotifier } from "./notifier";
import { AlertsRepository, type AlertsRepositoryPort } from "./repository";
import {
  CALENDAR_EVENTS_IN_WINDOW_SQL,
  INSERT_DELIVERY_SQL,
  SWEEP_DELIVERIES_SQL,
  subjectKey,
  toAlertCalendarEvent,
  type AlertCalendarEvent,
  type AlertRuleRow,
  type CalendarEventDbRow,
} from "./table";

const PRICE_PREFIX = "price:";
const CALENDAR_PREFIX = "calendar:";
const CALENDAR_WINDOW_MS = 60 * 60 * 1000;
const DAILY_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;
const DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FANOUT_TIMEOUT_MS = 3000;

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

type Pool = NonNullable<import("pg").Pool>;
type AlertsNotifierService = typeof AlertsNotifier.Service;
type HyperliquidProviderService = typeof HyperliquidProvider.Service;
type PriceRuleRow = AlertRuleRow & { readonly rule: Extract<Rule, { kind: "price" }> };
type CalendarRuleRow = AlertRuleRow & { readonly rule: Extract<Rule, { kind: "calendar" }> };

export interface AlertsWorkerState {
  readonly ruleStates: Map<string, RuleState>;
  readonly mids: Map<string, number>;
  lastPriceFailure: string | null;
  lastCalendarFailure: string | null;
  lastSweepAt: number | null;
}

export const makeAlertsWorkerState = (): AlertsWorkerState => ({
  ruleStates: new Map(),
  mids: new Map(),
  lastPriceFailure: null,
  lastCalendarFailure: null,
  lastSweepAt: null,
});

// One instance for the lifetime of the worker so the fan-out health map
// accumulates consecutive failures across ticks instead of resetting per tick.
export class ChannelFanout extends Context.Service<ChannelFanout, Fanout>()("ChannelFanout") {}

const ChannelFanoutLayer: Layer.Layer<ChannelFanout, never, ChannelsService | AlertsConfig> =
  Layer.effect(
    ChannelFanout,
    Effect.gen(function* () {
      const channels = yield* ChannelsService;
      const config = yield* AlertsConfig;

      return ChannelFanout.of(
        createFanout({
          forSubjects: channels.forSubjects,
          markSent: channels.markSent,
          markError: channels.markError,
          fetchImpl: (input, init) => fetch(input, init),
          config,
        } satisfies FanoutDeps),
      );
    }),
  );

export const ChannelFanoutWithInfra: Layer.Layer<ChannelFanout, never, PostgresConnectionPool> =
  ChannelFanoutLayer.pipe(
    Layer.provide(ChannelsServiceWithInfra),
    Layer.provide(AlertsConfigLayer.pipe(Layer.orDie)),
  );

const isPriceRule = (row: AlertRuleRow): row is PriceRuleRow => row.rule.kind === "price";
const isCalendarRule = (row: AlertRuleRow): row is CalendarRuleRow => row.rule.kind === "calendar";

const subjectOf = (row: AlertRuleRow): string =>
  subjectKey({ type: row.subjectType, id: row.subjectId });

const pruneRuleStates = (state: AlertsWorkerState, rules: readonly AlertRuleRow[]): void => {
  if (state.ruleStates.size === 0) return;
  const live = new Set(rules.map((row) => row.id));
  for (const id of state.ruleStates.keys()) {
    if (!live.has(id)) state.ruleStates.delete(id);
  }
};

const replaceMids = (target: Map<string, number>, mids: Record<string, string>): void => {
  target.clear();
  for (const [symbol, raw] of Object.entries(mids)) {
    if (raw.trim() === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) target.set(symbol, value);
  }
};

const midFor = (mids: Map<string, number>, subject: string): number | undefined => {
  const symbol = subject.slice(PRICE_PREFIX.length);
  return mids.get(symbol) ?? mids.get(symbol.toUpperCase());
};

const recordDelivery = (
  pool: Pool,
  ruleId: string,
  now: number,
  notice: Notice,
): Effect.Effect<boolean, Error> =>
  Effect.tryPromise({
    try: async () => {
      const result = await pool.query<{ id: string }>(INSERT_DELIVERY_SQL, [
        ruleId,
        `${ruleId}:${Math.floor(now / 1000)}`,
        Math.trunc(now),
        JSON.stringify(notice),
      ]);
      return result.rows.length > 0;
    },
    catch: (cause) => new Error(`Failed to record alert delivery: ${errorMessage(cause)}`),
  });

interface DailyCap {
  readonly allows: (row: AlertRuleRow) => Effect.Effect<boolean>;
  readonly recordInsert: (row: AlertRuleRow) => void;
  readonly logSummary: () => Effect.Effect<void>;
}

// One count per subject per tick, seeded on the first fire candidate so subjects
// without candidates cost no query. A failed count is treated as at-cap: the cap
// is a safety control, so a database error must not open it.
const makeDailyCap = (repo: AlertsRepositoryPort, limit: number, now: number): DailyCap => {
  const counts = new Map<string, number>();
  const suppressedRules = new Set<string>();
  let suppressed = 0;
  let countFailure: string | null = null;

  const countFor = (row: AlertRuleRow): Effect.Effect<number> =>
    repo
      .countDeliveriesForSubjectSince(row.subjectType, row.subjectId, now - DAILY_CAP_WINDOW_MS)
      .pipe(
        Effect.catch((error) => {
          countFailure ??= errorMessage(error);
          return Effect.succeed(limit);
        }),
      );

  return {
    allows: (row) =>
      Effect.gen(function* () {
        const key = subjectOf(row);
        const cached = counts.get(key);
        const count = cached ?? (yield* countFor(row));
        counts.set(key, count);
        if (count < limit) return true;

        if (!suppressedRules.has(row.id)) {
          suppressedRules.add(row.id);
          suppressed += 1;
        }
        return false;
      }),

    recordInsert: (row) => {
      const key = subjectOf(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },

    logSummary: () =>
      suppressed === 0
        ? Effect.void
        : Effect.logWarning(
            `[alerts] daily cap ${limit} suppressed ${suppressed} rule(s) in the past 24h` +
              (countFailure === null ? "" : ` (delivery count failed: ${countFailure})`),
          ),
  };
};

const scheduleFanout = (fanout: Fanout, row: AlertRuleRow, notice: Notice): Effect.Effect<void> =>
  Effect.forkChild(
    fanout.deliver({ type: row.subjectType, id: row.subjectId }, notice, row.rule.targets).pipe(
      Effect.timeoutOption(Duration.millis(FANOUT_TIMEOUT_MS)),
      Effect.tap((outcome) =>
        Option.isNone(outcome)
          ? Effect.logWarning(`[alerts] channel fanout timed out (rule ${row.id})`)
          : Effect.void,
      ),
      Effect.catchCause(() => Effect.logWarning(`[alerts] channel fanout failed (rule ${row.id})`)),
    ),
  ).pipe(Effect.asVoid);

const deliver = (
  pool: Pool,
  notifier: AlertsNotifierService,
  cap: DailyCap,
  fanout: Fanout,
  row: AlertRuleRow,
  notice: Notice,
  now: number,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (!(yield* cap.allows(row))) return;

    const inserted = yield* recordDelivery(pool, row.id, now, notice).pipe(
      Effect.catch((error) =>
        Effect.logWarning(`[alerts] ${error.message} (rule ${row.id})`).pipe(Effect.as(false)),
      ),
    );
    if (!inserted) return;

    cap.recordInsert(row);
    notifier.publish({ type: row.subjectType, id: row.subjectId }, notice);
    yield* scheduleFanout(fanout, row, notice);
  });

const loadCalendarEvents = (
  pool: Pool,
  now: number,
  state: AlertsWorkerState,
): Effect.Effect<AlertCalendarEvent[]> =>
  Effect.gen(function* () {
    const loaded = yield* Effect.tryPromise({
      try: async () => {
        const result = await pool.query<CalendarEventDbRow>(CALENDAR_EVENTS_IN_WINDOW_SQL, [
          Math.trunc(now),
          Math.trunc(now + CALENDAR_WINDOW_MS),
        ]);
        return result.rows;
      },
      catch: (cause) => new Error(`Failed to load calendar events: ${errorMessage(cause)}`),
    }).pipe(
      Effect.map((rows) => ({ ok: true as const, rows })),
      Effect.catch((error) => {
        const firstFailure = state.lastCalendarFailure !== error.message;
        state.lastCalendarFailure = error.message;
        return firstFailure
          ? Effect.logWarning(`[alerts] ${error.message}`).pipe(Effect.as({ ok: false as const }))
          : Effect.succeed({ ok: false as const });
      }),
    );

    if (!loaded.ok) return [];
    state.lastCalendarFailure = null;
    return loaded.rows
      .map(toAlertCalendarEvent)
      .filter((event): event is AlertCalendarEvent => event !== null);
  });

const refreshMids = (
  state: AlertsWorkerState,
  provider: HyperliquidProviderService,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const refreshed = yield* provider.getAllMids().pipe(
      Effect.map((mids) => ({ ok: true as const, mids })),
      Effect.catch((error) => {
        const message = errorMessage(error);
        const firstFailure = state.lastPriceFailure !== message;
        state.lastPriceFailure = message;
        return firstFailure
          ? Effect.logWarning(
              `[alerts] price fetch failed; keeping previous mids: ${message}`,
            ).pipe(Effect.as({ ok: false as const }))
          : Effect.succeed({ ok: false as const });
      }),
    );

    if (!refreshed.ok) return;
    state.lastPriceFailure = null;
    replaceMids(state.mids, refreshed.mids);
  });

const sweepDeliveries = (state: AlertsWorkerState, pool: Pool, now: number): Effect.Effect<void> =>
  Effect.gen(function* () {
    const due = state.lastSweepAt === null || now - state.lastSweepAt >= SWEEP_INTERVAL_MS;
    if (!due) return;
    // Marked before the attempt so a persistently failing sweep retries hourly,
    // not on every tick.
    state.lastSweepAt = now;

    yield* Effect.tryPromise({
      try: () => pool.query(SWEEP_DELIVERIES_SQL, [Math.trunc(now - DELIVERY_RETENTION_MS)]),
      catch: (cause) => new Error(`Failed to sweep alert deliveries: ${errorMessage(cause)}`),
    }).pipe(Effect.catch((error) => Effect.logWarning(`[alerts] ${error.message}`)));
  });

interface TickContext {
  readonly pool: Pool;
  readonly notifier: AlertsNotifierService;
  readonly cap: DailyCap;
  readonly fanout: Fanout;
  readonly state: AlertsWorkerState;
  readonly now: number;
}

const deliverPriceGroup = (
  rows: readonly PriceRuleRow[],
  price: number,
  ctx: TickContext,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (const row of rows) {
      const result = evaluate(
        row.rule,
        { kind: "price", value: price },
        ctx.now,
        ctx.state.ruleStates.get(row.id) ?? initialState(),
      );
      ctx.state.ruleStates.set(row.id, result.state);
      if (result.fire !== null) {
        yield* deliver(ctx.pool, ctx.notifier, ctx.cap, ctx.fanout, row, result.fire, ctx.now);
      }
    }
  });

const processPriceRules = (
  priceRules: readonly PriceRuleRow[],
  provider: HyperliquidProviderService,
  ctx: TickContext,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* refreshMids(ctx.state, provider);

    const bySubject = new Map<string, PriceRuleRow[]>();
    for (const row of priceRules) {
      const subject = row.rule.condition.subject;
      const indexed = bySubject.get(subject);
      if (indexed === undefined) bySubject.set(subject, [row]);
      else indexed.push(row);
    }

    for (const [subject, subjectRules] of bySubject) {
      const price = midFor(ctx.state.mids, subject);
      if (price === undefined) continue;

      yield* deliverPriceGroup(subjectRules, price, ctx);
    }
  });

const deliverCalendarRow = (
  events: readonly AlertCalendarEvent[],
  row: CalendarRuleRow,
  ctx: TickContext,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const target = row.rule.condition.subject.slice(CALENDAR_PREFIX.length).toUpperCase();

    for (const event of events) {
      if (event.currency.toUpperCase() !== target) continue;

      const result = evaluate(
        row.rule,
        {
          kind: "calendar",
          scheduledAt: event.scheduledAt,
          impact: event.impact,
          currency: event.currency,
        },
        ctx.now,
        ctx.state.ruleStates.get(row.id) ?? initialState(),
      );
      ctx.state.ruleStates.set(row.id, result.state);
      if (result.fire !== null) {
        yield* deliver(ctx.pool, ctx.notifier, ctx.cap, ctx.fanout, row, result.fire, ctx.now);
      }
    }
  });

const processCalendarRules = (
  calendarRules: readonly CalendarRuleRow[],
  ctx: TickContext,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const events = yield* loadCalendarEvents(ctx.pool, ctx.now, ctx.state);
    for (const row of calendarRules) {
      yield* deliverCalendarRow(events, row, ctx);
    }
  });

export const alertsWorkerTick = (
  state: AlertsWorkerState,
): Effect.Effect<
  void,
  never,
  | AlertsConfig
  | AlertsRepository
  | AlertsNotifier
  | HyperliquidProvider
  | PostgresConnectionPool
  | ChannelFanout
> =>
  Effect.gen(function* () {
    const repo = yield* AlertsRepository;
    const notifier = yield* AlertsNotifier;
    const provider = yield* HyperliquidProvider;
    const pool = yield* PostgresConnectionPool;
    if (pool === null) return;

    const config = yield* AlertsConfig;
    const fanout = yield* ChannelFanout;
    const now = yield* Clock.currentTimeMillis;
    const cap = makeDailyCap(repo, config.dailyCap, now);

    const loaded = yield* repo.listAllEnabled().pipe(
      Effect.map((rules) => ({ ok: true as const, rules })),
      Effect.catch((error) =>
        Effect.logWarning(`[alerts] enabled rule load failed: ${errorMessage(error)}`).pipe(
          Effect.as({ ok: false as const }),
        ),
      ),
    );

    // A failed read is not "no rules": keep the per-rule state so a transient
    // error cannot reset pending/crossing windows.
    if (loaded.ok) {
      const rules = loaded.rules;
      pruneRuleStates(state, rules);

      const ctx: TickContext = { pool, notifier, cap, fanout, state, now };
      const priceRules = rules.filter((row): row is PriceRuleRow => isPriceRule(row));
      const calendarRules = rules.filter((row): row is CalendarRuleRow => isCalendarRule(row));

      if (priceRules.length > 0) yield* processPriceRules(priceRules, provider, ctx);

      // Liquidation rules are intentionally unsampled in this lane: no
      // position poller exists yet, and a skipped sample is not an error.
      if (calendarRules.length > 0) yield* processCalendarRules(calendarRules, ctx);
    }

    yield* cap.logSummary();
    yield* sweepDeliveries(state, pool, now);
  });
