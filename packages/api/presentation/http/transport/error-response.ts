import { CORS_HEADERS } from "./cors";

export type HttpError = {
  readonly message?: string;
  readonly status?: number;
};

export const toHttpError = (error: unknown): HttpError =>
  typeof error === "object" && error !== null ? (error as HttpError) : {};

export const extractErrorMessage = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        if (typeof parsed.message === "string") {
          return parsed.message;
        }
      } catch {
        return value;
      }
    }

    return value;
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as { message?: unknown };
    if (typeof candidate.message === "string") {
      return extractErrorMessage(candidate.message);
    }
  }

  return undefined;
};

export const errorResponse = (error: unknown): Response => {
  const httpError = toHttpError(error);

  const message =
    extractErrorMessage(httpError.message) || extractErrorMessage(error) || "Internal server error";
  const status = httpError.status ?? 500;

  return new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
};
