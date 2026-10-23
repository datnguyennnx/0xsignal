/**
 * Auth boundary types — shared between auth backend and frontend app.
 *
 * Canonical declaration of the auth wire contract. The Effect Schema in
 * `packages/auth/src/presentation/auth.schemas.ts` is annotated with this type,
 * so the validator cannot drift from it.
 */

// Auth Me Response
// Response shape for the GET /api/auth/me endpoint.

export interface AuthMeResponse {
  readonly userId: string;
  readonly provider: string;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}
