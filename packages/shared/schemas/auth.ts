/**
 * Auth boundary types — shared between auth backend and frontend app.
 *
 * SOURCE OF TRUTH: `packages/auth/src/presentation/auth.schemas.ts` defines
 * the `AuthMeResponseSchema` Effect Schema. This pure TypeScript interface is
 * manually kept in sync. When updating, ensure the fields match the Schema.
 */

// Auth Me Response
// Response shape for the GET /api/auth/me endpoint.

export interface AuthMeResponse {
  readonly userId: string;
  readonly provider: string;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}
