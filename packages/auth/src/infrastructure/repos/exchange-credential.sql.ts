import type { Redacted } from "effect/Redacted";
import type { EncryptedCredentialSecrets } from "./exchange-credential.keys";

// Owned by the SQL layer so both this module and the port import it without a cycle.
export interface CreateApiCredentialParams {
  readonly userId: string;
  readonly accountId: string;
  readonly credentialSubtype: "agent" | "eoa" | "hardware";
  readonly label?: string | undefined;
  readonly agentAddress?: string;
  /** Plaintext agent private key — will be encrypted before storage */
  readonly agentKey?: Redacted;
  /** Plaintext EOA private key — will be encrypted before storage */
  readonly eoaKey?: string;
  readonly derivationPath?: string;
  readonly permissions?: readonly string[];
  readonly ipWhitelist?: readonly string[];
  readonly expiresAt?: string;
  readonly encryptionVersion?: number;
  readonly isVerified?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export type CredentialQuery = {
  readonly text: string;
  readonly values: unknown[];
};

export const SELECT_ACCOUNT_ID_SQL = "SELECT id FROM exchange_accounts WHERE id = $1";

export const SELECT_CREDENTIAL_OWNER_SQL =
  "SELECT id FROM api_credentials WHERE id = $1 AND user_id = $2";

export const ACTIVE_CREDENTIAL_FOR_SUBTYPE_SQL = `SELECT ac.* FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id AND ea.user_id = $2
             WHERE ac.account_id = $1
               AND ac.credential_subtype = $3
               AND ac.is_active = true
               AND ac.is_revoked = false
             LIMIT 1`;

export const ACTIVE_CREDENTIAL_SQL = `SELECT ac.* FROM api_credentials ac
           JOIN exchange_accounts ea ON ea.id = ac.account_id AND ea.user_id = $2
           WHERE ac.account_id = $1
             AND ac.is_active = true
             AND ac.is_revoked = false
           ORDER BY ac.created_at DESC
           LIMIT 1`;

export const AGENT_CREDENTIAL_DETAIL_SQL = `SELECT ac.*,
                    ea.node_type,
                    ea.wallet_address AS account_wallet_address,
                    ea.parent_id AS account_parent_id,
                    e.slug AS exchange_slug
             FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id
             JOIN exchanges e ON e.id = ea.exchange_id
             WHERE ac.id = $1 AND ac.user_id = $2`;

export const CREDENTIAL_DETAIL_SQL = `SELECT ac.*,
                    ea.wallet_address AS account_wallet_address,
                    e.slug AS exchange_slug
             FROM api_credentials ac
             JOIN exchange_accounts ea ON ea.id = ac.account_id
             JOIN exchanges e ON e.id = ea.exchange_id
             WHERE ac.id = $1 AND ac.user_id = $2`;

const INSERT_CREDENTIAL_SQL = `INSERT INTO api_credentials
             (account_id, user_id, credential_subtype, label,
              agent_address, enc_agent_key, enc_eoa_key,
              derivation_path, permissions, ip_whitelist,
              expires_at, encryption_version, is_verified, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
             RETURNING *`;

const ROTATE_CREDENTIAL_INSERT_SQL = `INSERT INTO api_credentials
               (account_id, user_id, credential_subtype, label,
                agent_address, enc_agent_key, enc_eoa_key,
                derivation_path, permissions, ip_whitelist,
                expires_at, encryption_version, is_verified, metadata,
                rotated_from)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
               RETURNING *`;

export const DEACTIVATE_CREDENTIAL_SQL =
  "UPDATE api_credentials SET is_active = false WHERE id = $1";

export const REVOKE_CREDENTIAL_SQL = `UPDATE api_credentials
           SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1
           WHERE id = $2 AND user_id = $3
           RETURNING id`;

export const VERIFY_CREDENTIAL_SQL = `UPDATE api_credentials
           SET is_verified = true, verified_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id`;

export const MARK_USED_SQL = "UPDATE api_credentials SET last_used_at = NOW() WHERE id = $1";

export const INSERT_AUDIT_LOG_SQL = `INSERT INTO credential_audit_log
         (user_id, account_id, credential_id, action, context)
         VALUES ($1, $2, $3, $4, $5::jsonb)`;

const credentialInsertValues = (
  params: CreateApiCredentialParams,
  secrets: EncryptedCredentialSecrets,
): unknown[] => [
  params.accountId,
  params.userId,
  params.credentialSubtype,
  params.label ?? "",
  params.credentialSubtype === "agent" ? (params.agentAddress ?? null) : null,
  secrets.encAgentKey ?? null,
  secrets.encEoaKey ?? null,
  params.credentialSubtype === "hardware" ? (params.derivationPath ?? null) : null,
  params.permissions ?? [],
  params.ipWhitelist ?? null,
  params.expiresAt ?? null,
  params.encryptionVersion ?? 1,
  params.isVerified ?? false,
  JSON.stringify(params.metadata ?? {}),
];

export const buildCreateCredentialQuery = (
  params: CreateApiCredentialParams,
  secrets: EncryptedCredentialSecrets,
): CredentialQuery => ({
  text: INSERT_CREDENTIAL_SQL,
  values: credentialInsertValues(params, secrets),
});

export const buildRotateCredentialQuery = (
  oldId: string,
  params: CreateApiCredentialParams,
  secrets: EncryptedCredentialSecrets,
): CredentialQuery => ({
  text: ROTATE_CREDENTIAL_INSERT_SQL,
  values: [...credentialInsertValues(params, secrets), oldId],
});
