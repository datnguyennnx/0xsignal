import { randomUUID } from "node:crypto";
import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { parseRule, ruleSignature, type Rule } from "@0xsignal/shared/alerts";
import { AlertsConfig } from "./config";
import { AlertsErrors, errorMessage, type AlertsError } from "./errors";
import {
  AlertsRepository,
  countUnreadDeliveries,
  listDeliveries,
  markDeliveriesSeen,
  type NewAlertRule,
} from "./repository";
import type { AlertRuleRow, DeliveryRow, Subject } from "./table";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AlertRulePatch {
  readonly enabled?: boolean;
}

export interface AlertsServicePort {
  readonly list: (subject: Subject) => Effect.Effect<AlertRuleRow[], AlertsError>;

  readonly create: (
    subject: Subject,
    input: Rule,
    now: number,
  ) => Effect.Effect<AlertRuleRow, AlertsError>;

  readonly update: (
    subject: Subject,
    id: string,
    patch: AlertRulePatch,
    now: number,
  ) => Effect.Effect<AlertRuleRow, AlertsError>;

  readonly remove: (subject: Subject, id: string) => Effect.Effect<void, AlertsError>;

  readonly countForSubject: (subject: Subject) => Effect.Effect<number, AlertsError>;

  readonly countDeliveriesSince: (
    subject: Subject,
    sinceMs: number,
  ) => Effect.Effect<number, AlertsError>;

  readonly listDeliveries: (
    subject: Subject,
    limit?: number,
  ) => Effect.Effect<DeliveryRow[], AlertsError>;

  readonly unreadCount: (subject: Subject) => Effect.Effect<number, AlertsError>;

  readonly markSeen: (subject: Subject, now: number) => Effect.Effect<void, AlertsError>;
}

export class AlertsService extends Context.Service<AlertsService, AlertsServicePort>()(
  "AlertsService",
) {}

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const parseInput = (input: Rule): Effect.Effect<Rule, AlertsError> =>
  Effect.try({
    try: () => parseRule(input),
    catch: (cause) => new AlertsErrors.InvalidRule({ message: errorMessage(cause) }),
  });

const makeAlertsService = () =>
  Effect.gen(function* () {
    const repo = yield* AlertsRepository;
    const config = yield* AlertsConfig;
    const pool = yield* PostgresConnectionPool;
    const deliveryPool =
      pool ??
      (yield* Effect.die(new Error("PostgresConnectionPool required for alert deliveries")));

    return AlertsService.of({
      list: (subject) => repo.list(subject),

      create: (subject, input, now) =>
        Effect.gen(function* () {
          const rule = yield* parseInput(input);
          const signature = ruleSignature(rule);

          // A retried create must return the stored rule even at the limit, or
          // the web UI retry and the claim flow would fail instead of staying idempotent.
          const stored = yield* repo.countForSubject(subject);
          if (stored >= config.maxRulesPerDevice) {
            const existing = yield* repo.findBySignature(subject, signature);
            if (existing !== null) return existing;
            return yield* new AlertsErrors.LimitExceeded({ limit: config.maxRulesPerDevice });
          }

          const newRule: NewAlertRule = {
            id: randomUUID(),
            subjectType: subject.type,
            subjectId: subject.id,
            rule,
            signature,
            createdAtMs: now,
          };
          return yield* repo.insert(newRule);
        }),

      update: (subject, id, patch) =>
        Effect.gen(function* () {
          if (!isUuid(id)) return yield* new AlertsErrors.NotFound({ id });

          const enabled = patch.enabled;
          if (enabled === undefined) {
            const current = yield* repo.findById(subject, id);
            if (current === null) return yield* new AlertsErrors.NotFound({ id });
            return current;
          }

          const updated = yield* repo.setEnabled(subject, id, enabled);
          if (updated === null) return yield* new AlertsErrors.NotFound({ id });
          return updated;
        }),

      remove: (subject, id) =>
        Effect.gen(function* () {
          if (!isUuid(id)) yield* new AlertsErrors.NotFound({ id });

          const removed = yield* repo.remove(subject, id);
          if (!removed) yield* new AlertsErrors.NotFound({ id });
        }),

      countForSubject: (subject) => repo.countForSubject(subject),

      countDeliveriesSince: (subject, sinceMs) => repo.countDeliveriesSince(subject, sinceMs),

      listDeliveries: (subject, limit) => listDeliveries(deliveryPool, subject, limit),

      unreadCount: (subject) => countUnreadDeliveries(deliveryPool, subject),

      markSeen: (subject, now) => markDeliveriesSeen(deliveryPool, subject, now),
    });
  });

export const AlertsServiceLayer: Layer.Layer<
  AlertsService,
  never,
  AlertsRepository | AlertsConfig | PostgresConnectionPool
> = Layer.effect(AlertsService, makeAlertsService());
