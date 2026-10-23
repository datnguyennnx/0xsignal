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
