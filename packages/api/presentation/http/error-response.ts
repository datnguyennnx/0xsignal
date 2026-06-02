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

export const errorResponse = (error: unknown, corsHeaders: Record<string, string>): Response => {
  const httpError = toHttpError(error);

  const message =
    extractErrorMessage(httpError.message) || extractErrorMessage(error) || "Internal server error";
  const status = httpError.status ?? 500;
  const code = httpError.code;

  const body: Record<string, unknown> = { error: message, status };
  if (code) {
    body.code = code;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};
