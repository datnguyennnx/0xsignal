import type { ApiCredential } from "../../domain/exchange-credential";

export type CredentialRow = {
  readonly id: string;
  readonly account_id: string;
  readonly user_id: string;
  readonly credential_subtype: ApiCredential["credentialSubtype"];
  readonly label: string;
  readonly agent_address: string | null;
  readonly enc_agent_key: string | null;
  readonly enc_eoa_key: string | null;
  readonly derivation_path: string | null;
  readonly permissions: readonly string[] | null;
  readonly ip_whitelist: readonly string[] | null;
  readonly expires_at: Date | string | null;
  readonly last_used_at: Date | string | null;
  readonly is_active: boolean;
  readonly is_revoked: boolean;
  readonly revoked_at: Date | string | null;
  readonly revoked_reason: string | null;
  readonly rotated_from: string | null;
  readonly encryption_version: number;
  readonly is_verified: boolean;
  readonly verified_at: Date | string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
};

const ts = (v: Date | string | null): string => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return "";
};

/**
 * Maps a raw DB row to an ApiCredential domain type.
 */
export function mapCredentialRow(row: CredentialRow): ApiCredential {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    credentialSubtype: row.credential_subtype,
    label: row.label,
    ...(row.agent_address !== null && { agentAddress: row.agent_address }),
    ...(row.enc_agent_key !== null && { encAgentKey: row.enc_agent_key }),
    ...(row.enc_eoa_key !== null && { encEoaKey: row.enc_eoa_key }),
    ...(row.derivation_path !== null && { derivationPath: row.derivation_path }),
    permissions: row.permissions ?? [],
    ...(row.ip_whitelist !== null && { ipWhitelist: row.ip_whitelist }),
    ...(row.expires_at !== null && { expiresAt: ts(row.expires_at) }),
    ...(row.last_used_at !== null && { lastUsedAt: ts(row.last_used_at) }),
    isActive: row.is_active,
    isRevoked: row.is_revoked,
    ...(row.revoked_at !== null && { revokedAt: ts(row.revoked_at) }),
    ...(row.revoked_reason !== null && { revokedReason: row.revoked_reason }),
    ...(row.rotated_from !== null && { rotatedFrom: row.rotated_from }),
    encryptionVersion: row.encryption_version,
    isVerified: row.is_verified,
    ...(row.verified_at !== null && { verifiedAt: ts(row.verified_at) }),
    metadata: row.metadata ?? {},
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}
