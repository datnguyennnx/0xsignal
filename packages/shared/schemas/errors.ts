/**
 * Shared error contract between backend and frontend.
 *
 * Backend sends: `{ error: "message", code?: "INSUFFICIENT_MARGIN" }`
 * Frontend receives: mapped into `ApiError` with `.code` field.
 */
export interface ApiErrorBody {
  readonly error: string;
  readonly code?: string;
  readonly status?: number;
}
