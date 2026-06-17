import { Match } from "effect";
import { DomainError } from "../../application/errors";
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

const mapDomainCodeToHttpStatus = (code: DomainError["code"]): number =>
  Match.value(code).pipe(
    Match.when("VALIDATION_ERROR", () => 400 as const),
    Match.when("NOT_FOUND", () => 404 as const),
    Match.when("FORBIDDEN", () => 403 as const),
    Match.when("ALREADY_EXISTS", () => 409 as const),
    Match.when("CONFLICT", () => 409 as const),
    Match.when("INVALID_STATE", () => 409 as const),
    Match.when("INTERNAL_ERROR", () => 502 as const),
    Match.orElse(() => 500 as const),
  );

const toErrorCode = (tag: string): string =>
  Match.value(tag).pipe(
    Match.when("DomainError", () => "DOMAIN_ERROR"),
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
    // Application-level DomainError (carries a DomainErrorCode for status mapping)
    Match.when(Match.instanceOf(DomainError), (e) =>
      asHttpError(mapDomainCodeToHttpStatus(e.code), e.message, toErrorCode(e._tag)),
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
