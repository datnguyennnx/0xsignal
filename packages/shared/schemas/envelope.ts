/**
 * API Envelope — consistent wrapper around all REST API responses.
 *
 * Every backend endpoint returns `{ data: T, meta?: Record<string, unknown> }`.
 * The frontend unwraps `.data` to get the typed payload.
 */
export interface ApiEnvelope<T> {
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}
