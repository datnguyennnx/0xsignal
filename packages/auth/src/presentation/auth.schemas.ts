/**
 * Effect Schema definitions for auth-domain HTTP contracts.
 *
 * These schemas serve as the source of truth for request/response shapes
 * at the auth HTTP boundary. Pure-TypeScript mirrors live in
 * @0xsignal/shared and are kept in sync via compile-time assertions.
 * (Source of truth: this file.)
 */

import { Schema } from "effect";

// GET /api/auth/me response

export const AuthMeResponseSchema = Schema.Struct({
  userId: Schema.String,
  provider: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
});
