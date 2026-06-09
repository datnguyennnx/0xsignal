import { Match } from "effect";
import { DomainError } from "../../application/errors";

export type HttpError = {
  readonly message?: string;
  readonly status?: number;
  readonly code?: string;
};

const toHttpError = (error: unknown): HttpError =>
  typeof error === "object" && error !== null ? (error as HttpError) : {};

const extractErrorMessage = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        if (typeof parsed.message === "string") return parsed.message;
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === "object" && value !== null) {
    const candidate = value as { message?: unknown };
    if (typeof candidate.message === "string") return extractErrorMessage(candidate.message);
  }
  return undefined;
};

export const errorResponse = (error: unknown, corsHeaders: Record<string, string>): Response => {
  const httpError = toHttpError(error);
  const message =
    extractErrorMessage(httpError.message) || extractErrorMessage(error) || "Internal server error";
  const status = httpError.status ?? 500;
  const code = httpError.code;
  const body: Record<string, unknown> = { error: message, status, ...(code ? { code } : {}) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const mapDomainCodeToHttpStatus = (code: DomainError["code"]): number =>
  Match.value(code).pipe(
    Match.when("VALIDATION_ERROR", () => 400 as const),
    Match.when("NOT_FOUND", () => 404 as const),
    Match.when("FORBIDDEN", () => 403 as const),
    Match.when("ALREADY_EXISTS", () => 409 as const),
    Match.when("CONFLICT", () => 409 as const),
    Match.when("INVALID_STATE", () => 409 as const),
    Match.when("INTERNAL_ERROR", () => 502 as const),
    Match.orElse(() => 500 as const)
  );

const toErrorCode = (tag: string): string =>
  Match.value(tag).pipe(
    Match.when("DomainError", () => "DOMAIN_ERROR"),
    Match.when("HyperliquidValidationError", () => "VALIDATION_ERROR"),
    Match.when("InsufficientMarginError", () => "INSUFFICIENT_MARGIN"),
    Match.when("HyperliquidInternalError", () => "INTERNAL_ERROR"),
    Match.orElse((t) => t)
  );

const mapDomainError = (error: DomainError) => ({
  status: mapDomainCodeToHttpStatus(error.code),
  message: error.message,
  code: toErrorCode(error._tag),
});

const mapTaggedError = (tagged: { _tag: string; message: string }) =>
  Match.value(tagged._tag).pipe(
    Match.when("HyperliquidValidationError", () => ({
      status: 400 as const,
      message: tagged.message,
      code: toErrorCode(tagged._tag),
    })),
    Match.when("InsufficientMarginError", () => ({
      status: 400 as const,
      message: tagged.message,
      code: toErrorCode(tagged._tag),
    })),
    Match.when("HyperliquidInternalError", () => ({
      status: 502 as const,
      message: tagged.message,
      code: toErrorCode(tagged._tag),
    })),
    Match.when("CredentialNotFound", () => ({
      status: 404 as const,
      message: "Credential not found",
      code: toErrorCode(tagged._tag),
    })),
    Match.when("CredentialRevoked", () => ({
      status: 403 as const,
      message: "Credential revoked",
      code: toErrorCode(tagged._tag),
    })),
    Match.when("CredentialExpired", () => ({
      status: 403 as const,
      message: "Credential expired",
      code: toErrorCode(tagged._tag),
    })),
    Match.when("CredentialUnverified", () => ({
      status: 403 as const,
      message: "Credential not verified",
      code: toErrorCode(tagged._tag),
    })),
    Match.when("AccountNotFound", () => ({
      status: 404 as const,
      message: "Account not found",
      code: toErrorCode(tagged._tag),
    })),
    Match.orElse(() => ({
      status: 500 as const,
      message: tagged.message,
      code: toErrorCode(tagged._tag),
    }))
  );

const mapUnknownError = (
  error: unknown
): {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
} => {
  if (error && typeof error === "object" && "_tag" in error) {
    return mapTaggedError(error as { _tag: string; message: string });
  }
  if (typeof error === "object" && error !== null) return mapPlainError(error);
  return { status: 500, message: "Internal server error" };
};

const mapPlainError = (error: object) => {
  const candidate = error as { status?: unknown; message?: unknown; code?: unknown };
  if (typeof candidate.status === "number" && typeof candidate.message === "string") {
    return {
      status: candidate.status,
      message: candidate.message,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
    };
  }
  if (typeof candidate.message === "string") {
    return { status: 500 as const, message: candidate.message };
  }
  return { status: 500 as const, message: "Internal server error" };
};

export const mapServiceError = (
  error: unknown
): {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
} =>
  Match.type<unknown>().pipe(
    Match.when(Match.instanceOf(DomainError), mapDomainError),
    Match.orElse(mapUnknownError)
  )(error);
