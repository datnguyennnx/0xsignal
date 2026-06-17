import { Match } from "effect";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
} from "../../application/errors";
import {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
} from "../../domain/errors";
import {
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  AccountNotFound,
} from "@0xsignal/auth";

export type HttpError = {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
};

export const asHttpError = (status: number, message: string, code?: string): HttpError => ({
  status,
  message,
  code,
});

const toErrorCode = (tag: string): string =>
  Match.value(tag).pipe(
    Match.when("HyperliquidValidationError", () => "VALIDATION_ERROR"),
    Match.when("InsufficientMarginError", () => "INSUFFICIENT_MARGIN"),
    Match.when("HyperliquidInternalError", () => "INTERNAL_ERROR"),
    Match.orElse((t) => t),
  );

export const errorResponse = (error: unknown, corsHeaders: Record<string, string>): Response => {
  const httpError = mapServiceError(error);
  const body: Record<string, unknown> = {
    error: httpError.message || "Internal server error",
    status: httpError.status,
    ...(httpError.code ? { code: httpError.code } : {}),
  };
  return new Response(JSON.stringify(body), {
    status: httpError.status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

export const mapServiceError = (error: unknown): HttpError =>
  Match.value(error).pipe(
    // Application-level tagged errors
    Match.when(Match.instanceOf(ValidationError), (e) =>
      asHttpError(400, e.message, toErrorCode(e._tag)),
    ),
    Match.when(Match.instanceOf(NotFoundError), (e) =>
      asHttpError(404, e.message, toErrorCode(e._tag)),
    ),
    Match.when(Match.instanceOf(ConflictError), (e) =>
      asHttpError(409, e.message, toErrorCode(e._tag)),
    ),
    Match.when(Match.instanceOf(InternalError), (e) =>
      asHttpError(502, e.message, toErrorCode(e._tag)),
    ),

    // Domain-layer tagged errors
    Match.when(Match.instanceOf(HyperliquidValidationError), (e) =>
      asHttpError(400, e.message, toErrorCode(e._tag)),
    ),
    Match.when(Match.instanceOf(InsufficientMarginError), (e) =>
      asHttpError(400, e.message, toErrorCode(e._tag)),
    ),
    Match.when(Match.instanceOf(HyperliquidInternalError), (e) =>
      asHttpError(502, e.message, toErrorCode(e._tag)),
    ),

    // Auth-package tagged errors (use hardcoded messages)
    Match.when(Match.instanceOf(CredentialNotFound), () =>
      asHttpError(404, "Credential not found", "CredentialNotFound"),
    ),
    Match.when(Match.instanceOf(CredentialRevoked), () =>
      asHttpError(403, "Credential revoked", "CredentialRevoked"),
    ),
    Match.when(Match.instanceOf(CredentialExpired), () =>
      asHttpError(403, "Credential expired", "CredentialExpired"),
    ),
    Match.when(Match.instanceOf(CredentialUnverified), () =>
      asHttpError(403, "Credential not verified", "CredentialUnverified"),
    ),
    Match.when(Match.instanceOf(AccountNotFound), () =>
      asHttpError(404, "Account not found", "AccountNotFound"),
    ),

    // Plain objects with a message field
    Match.when(
      (e: unknown): e is { message: string; status?: number; code?: string } =>
        typeof e === "object" && e !== null && "message" in e,
      (e) => asHttpError(e.status ?? 500, String(e.message), e.code ?? undefined),
    ),

    // Fallback for primitives, null, etc.
    Match.orElse((e) => asHttpError(500, String(e), "InternalError")),
  );
