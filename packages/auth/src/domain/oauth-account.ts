import type { UserId } from "./user";

export type OAuthProvider = "google" | "github";

export interface OAuthAccount {
  readonly id: string;
  readonly userId: UserId;
  readonly provider: OAuthProvider;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OAuthProfile {
  readonly provider: OAuthProvider;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}
