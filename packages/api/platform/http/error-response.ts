export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

export type HttpError = {
  readonly status: number;
  readonly message: string;
  readonly code?: string | undefined;
  readonly retryable: boolean;
  /** Set on a 503 so the response carries `Retry-After`. */
  readonly retryAfterSeconds?: number | undefined;
};

export const asHttpError = (
  status: number,
  message: string,
  code?: string,
  retryable = false,
): HttpError => ({
  status,
  message,
  code,
  retryable,
});

export const retryAfterHeader = (httpError: HttpError): Record<string, string> =>
  httpError.retryAfterSeconds === undefined
    ? {}
    : { "Retry-After": String(httpError.retryAfterSeconds) };

export const errorResponse = (
  httpError: HttpError,
  corsHeaders: Record<string, string>,
): Response => {
  const body: Record<string, unknown> = {
    error: httpError.message || "Internal server error",
    status: httpError.status,
    ...(httpError.code !== undefined && httpError.code !== "" ? { code: httpError.code } : {}),
    retryable: httpError.retryable,
  };
  return new Response(JSON.stringify(body), {
    status: httpError.status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...retryAfterHeader(httpError) },
  });
};
