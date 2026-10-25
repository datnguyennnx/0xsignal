import { Match } from "effect";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
  ServiceUnavailableError,
} from "../shared/errors";
import {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
} from "../shared/errors";
import { CalendarServiceError } from "../modules/calendar";
import { WhaleServiceError } from "../modules/whales";
import { OrderIntentRepoError } from "../modules/exchange";
import {
  OAuthCallbackFailed,
  OAuthStateExpired,
  OAuthStateMismatch,
  TokenExpired,
  TokenInvalid,
  TokenRevoked,
  UserSuspended,
  AccountNotFound,
  DuplicateLabel,
} from "@0xsignal/auth";
import { asHttpError, type HttpError } from "../platform/http/error-response";

type ErrorKind = {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
};

const UNKNOWN_KIND: ErrorKind = { status: 500, code: "INTERNAL_ERROR", retryable: false };

const kinds: Record<string, ErrorKind> = {
  ValidationError: { status: 400, code: "VALIDATION_ERROR", retryable: false },
  HyperliquidValidationError: { status: 400, code: "VALIDATION_ERROR", retryable: false },
  InsufficientMarginError: { status: 400, code: "INSUFFICIENT_MARGIN", retryable: false },

  NotFoundError: { status: 404, code: "NOT_FOUND", retryable: false },
  AccountNotFound: { status: 404, code: "NOT_FOUND", retryable: false },

  ConflictError: { status: 409, code: "CONFLICT", retryable: false },
  DuplicateLabel: { status: 409, code: "CONFLICT", retryable: false },

  UserSuspended: { status: 403, code: "FORBIDDEN", retryable: false },

  TokenExpired: { status: 401, code: "UNAUTHORIZED", retryable: false },
  TokenInvalid: { status: 401, code: "UNAUTHORIZED", retryable: false },
  TokenRevoked: { status: 401, code: "UNAUTHORIZED", retryable: false },
  OAuthStateMismatch: { status: 401, code: "UNAUTHORIZED", retryable: false },
  OAuthStateExpired: { status: 401, code: "UNAUTHORIZED", retryable: false },
  OAuthCallbackFailed: { status: 401, code: "UNAUTHORIZED", retryable: false },

  InternalError: { status: 502, code: "BAD_GATEWAY", retryable: true },
  HyperliquidInternalError: { status: 502, code: "BAD_GATEWAY", retryable: true },
  ServiceUnavailableError: { status: 503, code: "SERVICE_UNAVAILABLE", retryable: true },

  CalendarServiceError: { status: 500, code: "INTERNAL_ERROR", retryable: false },
  WhaleServiceError: { status: 500, code: "INTERNAL_ERROR", retryable: false },
  OrderIntentRepoError: { status: 500, code: "INTERNAL_ERROR", retryable: false },
};

const fromTag = (tag: string, message: string): HttpError => {
  const kind = kinds[tag] ?? UNKNOWN_KIND;
  return { status: kind.status, message, code: kind.code, retryable: kind.retryable };
};

// A raw SDK 429 is upstream overload, never a client-side 429. Surface 503 so
// callers back off instead of treating the response as their own rate limit.
const fromRawStatus = (status: number, message: string, code?: string): HttpError =>
  status === 429
    ? { status: 503, message, code: "SERVICE_UNAVAILABLE", retryable: true }
    : asHttpError(status, message, code);

// Split across two matches: a single Match pipe takes at most 20 arms.
const mapRemainingError = (error: unknown): HttpError =>
  Match.value(error).pipe(
    // Auth-package tagged errors (use hardcoded messages)
    Match.when(Match.instanceOf(AccountNotFound), () =>
      fromTag("AccountNotFound", "Account not found"),
    ),
    Match.when(Match.instanceOf(DuplicateLabel), () =>
      fromTag("DuplicateLabel", "Duplicate label"),
    ),
    Match.when(Match.instanceOf(TokenExpired), () => fromTag("TokenExpired", "Token expired")),
    Match.when(Match.instanceOf(TokenInvalid), () => fromTag("TokenInvalid", "Invalid token")),
    Match.when(Match.instanceOf(TokenRevoked), () => fromTag("TokenRevoked", "Token revoked")),
    Match.when(Match.instanceOf(UserSuspended), () => fromTag("UserSuspended", "User suspended")),
    Match.when(Match.instanceOf(OAuthStateMismatch), () =>
      fromTag("OAuthStateMismatch", "OAuth state mismatch"),
    ),
    Match.when(Match.instanceOf(OAuthStateExpired), () =>
      fromTag("OAuthStateExpired", "OAuth state expired"),
    ),
    Match.when(Match.instanceOf(OAuthCallbackFailed), () =>
      fromTag("OAuthCallbackFailed", "OAuth callback failed"),
    ),

    // Plain objects with a message field
    Match.when(
      (e: unknown): e is { message: string; status?: number; code?: string } =>
        typeof e === "object" && e !== null && "message" in e,
      (e) => fromRawStatus(e.status ?? 500, e.message, e.code ?? undefined),
    ),

    // Fallback for primitives, null, etc.
    Match.orElse((e) => asHttpError(500, String(e), UNKNOWN_KIND.code)),
  );

export const mapServiceError = (error: unknown): HttpError =>
  Match.value(error).pipe(
    // Application-level tagged errors
    Match.when(Match.instanceOf(ValidationError), (e) => fromTag("ValidationError", e.message)),
    Match.when(Match.instanceOf(NotFoundError), (e) => fromTag("NotFoundError", e.message)),
    Match.when(Match.instanceOf(ConflictError), (e) => fromTag("ConflictError", e.message)),
    Match.when(Match.instanceOf(InternalError), (e) => fromTag("InternalError", e.message)),
    Match.when(Match.instanceOf(ServiceUnavailableError), (e) =>
      fromTag("ServiceUnavailableError", e.message),
    ),

    // Domain-layer tagged errors
    Match.when(Match.instanceOf(HyperliquidValidationError), (e) =>
      fromTag("HyperliquidValidationError", e.message),
    ),
    Match.when(Match.instanceOf(InsufficientMarginError), (e) =>
      fromTag("InsufficientMarginError", e.message),
    ),
    Match.when(Match.instanceOf(HyperliquidInternalError), (e) =>
      fromTag("HyperliquidInternalError", e.message),
    ),

    // Service-layer failures: retryable false, no upstream transport behind them
    Match.when(Match.instanceOf(CalendarServiceError), (e) =>
      fromTag("CalendarServiceError", e.message),
    ),
    Match.when(Match.instanceOf(WhaleServiceError), (e) => fromTag("WhaleServiceError", e.message)),
    Match.when(Match.instanceOf(OrderIntentRepoError), (e) =>
      fromTag("OrderIntentRepoError", e.message),
    ),

    Match.orElse(mapRemainingError),
  );
