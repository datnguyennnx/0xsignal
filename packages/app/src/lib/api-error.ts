/** Transport-level API failure shared by the HTTP client, the base fetch layer and the auth store. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The request never produced an HTTP response: offline, DNS, CORS, socket reset. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/** A request that requires a session was issued without one. */
export class UnauthenticatedError extends Error {
  readonly _tag = "UnauthenticatedError";
}

/** A payload the SDK rejected will be rejected again; retrying only burns quota. */
export const VALIDATION_ERROR_CODE = "validation";
