import { createHash, randomUUID } from "node:crypto";
import { Context, Effect, Layer, Option } from "effect";
import { AuthService, PostgresConnectionPool } from "@0xsignal/auth";
import { AlertsErrors, errorMessage, type AlertsError } from "./errors";
import { TOUCH_ALERT_SUBSCRIPTION_SQL, type Subject } from "./table";

const ALERT_SID_COOKIE = "alert_sid";

const ACCESS_TOKEN_COOKIE = "access_token";
const ALERT_SID_MAX_AGE_SECONDS = 15_552_000;

type Pool = NonNullable<import("pg").Pool>;

interface ResolvedSubject {
  /** Null when the caller is unauthenticated and no device cookie exists. */
  readonly subject: Subject | null;
  /** Present only when a fresh device cookie was minted for a POST. */
  readonly setCookie?: string;
}

interface ResolveSubjectOptions {
  readonly mintDevice: boolean;
}

export interface AlertsIdentityPort {
  readonly resolve: (
    request: Request,
    options: ResolveSubjectOptions,
  ) => Effect.Effect<ResolvedSubject, AlertsError>;
}

export class AlertsIdentity extends Context.Service<AlertsIdentity, AlertsIdentityPort>()(
  "AlertsIdentity",
) {}

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

const cookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value === "" ? null : value;
  }
  return null;
};

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  return token === undefined || token === "" ? null : token;
};

// Authentication is optional here: an invalid or absent token falls through to
// the device cookie instead of rejecting the request. The service is looked up
// optionally so alerts still resolve a device identity in runtimes without auth.
const authenticatedUserId = (request: Request): Effect.Effect<string | null> =>
  Effect.gen(function* () {
    const auth = yield* Effect.serviceOption(AuthService);
    if (Option.isNone(auth)) return null;

    const token =
      bearerToken(request) ?? cookieValue(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
    if (token === null) return null;

    const session = yield* auth.value
      .verifyToken(token)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    return session === null ? null : session.userId;
  });

const touchSubscription = (pool: Pool, deviceId: string): Effect.Effect<void, AlertsError> =>
  Effect.tryPromise({
    try: async () => {
      await pool.query(TOUCH_ALERT_SUBSCRIPTION_SQL, [deviceId]);
    },
    catch: (cause) =>
      new AlertsErrors.Db({
        message: `Failed to update alert subscription: ${errorMessage(cause)}`,
        cause,
      }),
  });

const DEVICE_COOKIE_ATTRIBUTES = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ALERT_SID_MAX_AGE_SECONDS}`;

const deviceCookie = (raw: string): string =>
  `${ALERT_SID_COOKIE}=${raw}; ${DEVICE_COOKIE_ATTRIBUTES}`;

const resolveSubject = (
  pool: Pool,
  request: Request,
  options: ResolveSubjectOptions,
): Effect.Effect<ResolvedSubject, AlertsError> =>
  Effect.gen(function* () {
    const userId = yield* authenticatedUserId(request);
    if (userId !== null) return { subject: { type: "user", id: userId } };

    const rawDeviceId = cookieValue(request.headers.get("cookie"), ALERT_SID_COOKIE);
    if (rawDeviceId !== null) {
      const id = sha256Hex(rawDeviceId);
      yield* touchSubscription(pool, id);
      return { subject: { type: "device", id } };
    }

    if (!options.mintDevice) return { subject: null };

    const minted = randomUUID();
    const id = sha256Hex(minted);
    yield* touchSubscription(pool, id);
    return { subject: { type: "device", id }, setCookie: deviceCookie(minted) };
  });

export const AlertsIdentityLayer: Layer.Layer<AlertsIdentity, never, PostgresConnectionPool> =
  Layer.effect(
    AlertsIdentity,
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;
      if (pool === null) {
        return yield* Effect.die(
          new Error("PostgresConnectionPool required but was null — provide a proper pool"),
        );
      }

      return AlertsIdentity.of({
        resolve: (request, options) => resolveSubject(pool, request, options),
      });
    }),
  );
