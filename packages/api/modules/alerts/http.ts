import { Clock, Effect, Match } from "effect";
import { parseRule, type Rule } from "@0xsignal/shared/alerts";
import { asRecord } from "../../shared/parsing";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { errorMessage, type AlertsError } from "./errors";
import { AlertsService } from "./service";
import { AlertsIdentity } from "./subject";
import { subjectKey, type AlertRuleRow, type Subject } from "./table";

type ApiRule = Rule & { readonly id: string; readonly createdAt: string };

export interface AlertsRoute {
  readonly method: string;
  readonly path: string;
  readonly handler: (
    request: Request,
    url: URL,
    alerts: typeof AlertsService.Service,
    identity: typeof AlertsIdentity.Service,
  ) => Effect.Effect<Response, HttpError>;
}

export interface BuildAlertsRoutesParams {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
}

const ALERTS_PATH = "/api/alerts";
const DELIVERIES_PATH = `${ALERTS_PATH}/deliveries`;
const DELIVERIES_SEEN_PATH = `${DELIVERIES_PATH}/seen`;
const RULE_ID_PREFIX = `${ALERTS_PATH}/`;
const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 60 * 60 * 1000;

const mapAlertsError = (error: AlertsError): HttpError =>
  Match.value(error).pipe(
    Match.tag("InvalidRule", (invalid) => asHttpError(400, invalid.message, "INVALID_RULE")),
    Match.tag("NotFound", (missing) =>
      asHttpError(404, `Alert rule ${missing.id} not found`, "NOT_FOUND"),
    ),
    Match.tag("LimitExceeded", (exceeded) =>
      asHttpError(429, `Alert rule limit of ${exceeded.limit} reached`, "LIMIT_EXCEEDED"),
    ),
    Match.tag("Db", (db) => asHttpError(500, db.message, "INTERNAL_ERROR")),
    Match.exhaustive,
  );

const toApiRule = (row: AlertRuleRow): ApiRule => ({
  ...row.rule,
  id: row.id,
  createdAt: row.createdAt,
});

const readJsonBody = (request: Request): Effect.Effect<unknown, HttpError> =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => asHttpError(400, "Invalid JSON body", "INVALID_JSON"),
  });

const parseCreateBody = (body: unknown): Effect.Effect<Rule, HttpError> =>
  Effect.gen(function* () {
    const record = asRecord(body);
    if (record === null || !("rule" in record)) {
      return yield* Effect.fail(
        asHttpError(400, "Expected a rule in the request body", "INVALID_RULE"),
      );
    }

    return yield* Effect.try({
      try: () => parseRule(record["rule"]),
      catch: (cause) => asHttpError(400, errorMessage(cause), "INVALID_RULE"),
    });
  });

const parsePatchBody = (body: unknown): Effect.Effect<{ readonly enabled?: boolean }, HttpError> =>
  Effect.gen(function* () {
    const record = asRecord(body);
    if (record === null) {
      return yield* Effect.fail(asHttpError(400, "Expected a JSON object", "INVALID_BODY"));
    }

    const enabled = record["enabled"];
    if (enabled === undefined) return {};
    if (typeof enabled !== "boolean") {
      return yield* Effect.fail(asHttpError(400, "`enabled` must be a boolean", "INVALID_BODY"));
    }
    return { enabled };
  });

const ruleIdFrom = (url: URL): string => url.pathname.slice(RULE_ID_PREFIX.length);

const parseDeliveryLimit = (url: URL): number | undefined => {
  const raw = url.searchParams.get("limit");
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const makeCreateLimiter = (): ((subject: Subject, now: number) => boolean) => {
  const attempts = new Map<string, number[]>();

  return (subject, now) => {
    const key = subjectKey(subject);
    const recent = (attempts.get(key) ?? []).filter((at) => now - at < CREATE_WINDOW_MS);
    if (recent.length >= CREATE_LIMIT) {
      attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    attempts.set(key, recent);
    return true;
  };
};

export const buildAlertsRoutes = ({ json }: BuildAlertsRoutesParams): AlertsRoute[] => {
  const allowCreate = makeCreateLimiter();

  const respondWithRule = (row: AlertRuleRow, headers?: Record<string, string>): Response =>
    json({ rule: toApiRule(row) }, 200, headers);

  return [
    {
      method: "GET",
      path: ALERTS_PATH,
      handler: (request, _url, alerts, identity) =>
        Effect.gen(function* () {
          const resolved = yield* identity
            .resolve(request, { mintDevice: false })
            .pipe(Effect.mapError(mapAlertsError));
          if (resolved.subject === null) return json({ rules: [] });

          const rules = yield* alerts.list(resolved.subject).pipe(Effect.mapError(mapAlertsError));
          return json({ rules: rules.map((row) => toApiRule(row)) });
        }),
    },
    {
      method: "POST",
      path: ALERTS_PATH,
      handler: (request, _url, alerts, identity) =>
        Effect.gen(function* () {
          const body = yield* readJsonBody(request);
          const rule = yield* parseCreateBody(body);
          const now = yield* Clock.currentTimeMillis;
          const resolved = yield* identity
            .resolve(request, { mintDevice: true })
            .pipe(Effect.mapError(mapAlertsError));
          const subject = resolved.subject;
          if (subject === null) {
            return yield* Effect.fail(
              asHttpError(500, "Alert identity could not be resolved", "INTERNAL_ERROR"),
            );
          }
          if (!allowCreate(subject, now)) {
            return yield* Effect.fail(
              asHttpError(429, "Too many alert rules created; retry later", "RATE_LIMITED"),
            );
          }

          const row = yield* alerts
            .create(subject, rule, now)
            .pipe(Effect.mapError(mapAlertsError));
          return respondWithRule(
            row,
            resolved.setCookie === undefined ? undefined : { "Set-Cookie": resolved.setCookie },
          );
        }),
    },
    {
      method: "PATCH",
      path: `${ALERTS_PATH}/:id`,
      handler: (request, url, alerts, identity) =>
        Effect.gen(function* () {
          const body = yield* readJsonBody(request);
          const patch = yield* parsePatchBody(body);
          const id = ruleIdFrom(url);
          const resolved = yield* identity
            .resolve(request, { mintDevice: false })
            .pipe(Effect.mapError(mapAlertsError));
          if (resolved.subject === null) {
            return yield* Effect.fail(asHttpError(404, `Alert rule ${id} not found`, "NOT_FOUND"));
          }

          const now = yield* Clock.currentTimeMillis;
          const row = yield* alerts
            .update(resolved.subject, id, patch, now)
            .pipe(Effect.mapError(mapAlertsError));
          return respondWithRule(row);
        }),
    },
    {
      method: "DELETE",
      path: `${ALERTS_PATH}/:id`,
      handler: (request, url, alerts, identity) =>
        Effect.gen(function* () {
          const id = ruleIdFrom(url);
          const resolved = yield* identity
            .resolve(request, { mintDevice: false })
            .pipe(Effect.mapError(mapAlertsError));
          if (resolved.subject === null) {
            return yield* Effect.fail(asHttpError(404, `Alert rule ${id} not found`, "NOT_FOUND"));
          }

          yield* alerts.remove(resolved.subject, id).pipe(Effect.mapError(mapAlertsError));
          return new Response(null, { status: 204 });
        }),
    },
    {
      method: "GET",
      path: DELIVERIES_PATH,
      handler: (request, url, alerts, identity) =>
        Effect.gen(function* () {
          const resolved = yield* identity
            .resolve(request, { mintDevice: false })
            .pipe(Effect.mapError(mapAlertsError));
          const subject = resolved.subject;
          if (subject === null) {
            return yield* Effect.fail(
              asHttpError(401, "Alert subject could not be resolved", "UNAUTHORIZED"),
            );
          }

          const limit = parseDeliveryLimit(url);
          const deliveries = yield* alerts
            .listDeliveries(subject, limit)
            .pipe(Effect.mapError(mapAlertsError));
          const unread = yield* alerts.unreadCount(subject).pipe(Effect.mapError(mapAlertsError));
          return json({ deliveries, unread });
        }),
    },
    {
      method: "POST",
      path: DELIVERIES_SEEN_PATH,
      handler: (request, _url, alerts, identity) =>
        Effect.gen(function* () {
          const resolved = yield* identity
            .resolve(request, { mintDevice: false })
            .pipe(Effect.mapError(mapAlertsError));
          const subject = resolved.subject;
          if (subject === null) {
            return yield* Effect.fail(
              asHttpError(401, "Alert subject could not be resolved", "UNAUTHORIZED"),
            );
          }

          const now = yield* Clock.currentTimeMillis;
          yield* alerts.markSeen(subject, now).pipe(Effect.mapError(mapAlertsError));
          return new Response(null, { status: 204 });
        }),
    },
  ];
};
