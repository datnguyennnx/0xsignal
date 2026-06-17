import type { ApiCredential } from "../../domain/exchange-credential";

/**
 * Converts a timestamp DB value to ISO string.
 */
export const ts = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : v != null ? String(v) : (v as unknown as string);

/**
 * Maps a raw DB row to an ApiCredential domain type.
 */
export function mapCredentialRow(row: unknown): ApiCredential {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    userId: r.user_id as string,
    credentialSubtype: r.credential_subtype as "agent" | "eoa" | "hardware",
    label: r.label as string,
    agentAddress: (r.agent_address as string | undefined) ?? undefined,
    encAgentKey: (r.enc_agent_key as string | undefined) ?? undefined,
    encEoaKey: (r.enc_eoa_key as string | undefined) ?? undefined,
    derivationPath: (r.derivation_path as string | undefined) ?? undefined,
    permissions: (r.permissions as readonly string[] | undefined) ?? [],
    ipWhitelist: (r.ip_whitelist as readonly string[] | undefined) ?? undefined,
    expiresAt: r.expires_at != null ? ts(r.expires_at) : undefined,
    lastUsedAt: r.last_used_at != null ? ts(r.last_used_at) : undefined,
    isActive: r.is_active as boolean,
    isRevoked: r.is_revoked as boolean,
    revokedAt: r.revoked_at != null ? ts(r.revoked_at) : undefined,
    revokedReason: (r.revoked_reason as string | undefined) ?? undefined,
    rotatedFrom: (r.rotated_from as string | undefined) ?? undefined,
    encryptionVersion: r.encryption_version as number,
    isVerified: r.is_verified as boolean,
    verifiedAt: r.verified_at != null ? ts(r.verified_at) : undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}
