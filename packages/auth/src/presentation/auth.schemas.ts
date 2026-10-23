/**
 * Effect Schema definitions for auth-domain HTTP contracts.
 *
 * Wire shapes are declared in @0xsignal/shared; the annotation below makes the
 * validator fail to compile when it drifts from that contract.
 */

import { Schema } from "effect";
import type { AuthMeResponse } from "@0xsignal/shared";

// GET /api/auth/me response

export const AuthMeResponseSchema: Schema.Decoder<AuthMeResponse> = Schema.Struct({
  userId: Schema.String,
  provider: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
});
