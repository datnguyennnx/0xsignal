import { Schema, SchemaGetter } from "effect";
import * as RedactedNs from "effect/Redacted";
import type { Redacted } from "effect/Redacted";
import { EXCHANGE_SLUGS } from "./exchange-constants";

export const ExchangeName = Schema.Literals([...EXCHANGE_SLUGS] as const);
export type ExchangeName = Schema.Schema.Type<typeof ExchangeName>;

export const AccountNodeType = Schema.Literals(["wallet", "sub", "vault"] as const);
export type AccountNodeType = Schema.Schema.Type<typeof AccountNodeType>;

export const CredentialSubtype = Schema.Literals(["agent", "eoa", "hardware"] as const);
export type CredentialSubtype = Schema.Schema.Type<typeof CredentialSubtype>;

const RedactedString: Schema.Schema<Redacted> = Schema.String.pipe(
  Schema.decodeTo(
    Schema.declare((u): u is Redacted => RedactedNs.isRedacted(u), { identifier: "Redacted" }),
    {
      decode: SchemaGetter.transform((s: string) => RedactedNs.make(s)),
      encode: SchemaGetter.transform((r: Redacted) => RedactedNs.value(r)),
    },
  ),
);

const StringArray = Schema.TupleWithRest(Schema.Tuple([]), [Schema.String]);

// Maps to exchange_accounts table

export const ExchangeAccount = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  exchangeId: Schema.String,
  nodeType: AccountNodeType,
  parentId: Schema.optionalKey(Schema.String),
  walletAddress: Schema.String,
  chain: Schema.optionalKey(Schema.String),
  label: Schema.String,
  color: Schema.optionalKey(Schema.String),
  sortOrder: Schema.Number,
  isActive: Schema.Boolean,
  isPrimary: Schema.Boolean,
  metadata: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ExchangeAccount = Schema.Schema.Type<typeof ExchangeAccount>;

// enc_* fields are ciphertext

export const ApiCredential = Schema.Struct({
  id: Schema.String,
  accountId: Schema.String,
  userId: Schema.String,
  credentialSubtype: CredentialSubtype,
  label: Schema.String,
  agentAddress: Schema.optionalKey(Schema.String),
  encAgentKey: Schema.optionalKey(Schema.String),
  encEoaKey: Schema.optionalKey(Schema.String),
  derivationPath: Schema.optionalKey(Schema.String),
  permissions: StringArray,
  ipWhitelist: Schema.optionalKey(StringArray),
  expiresAt: Schema.optionalKey(Schema.String),
  lastUsedAt: Schema.optionalKey(Schema.String),
  isActive: Schema.Boolean,
  isRevoked: Schema.Boolean,
  revokedAt: Schema.optionalKey(Schema.String),
  revokedReason: Schema.optionalKey(Schema.String),
  rotatedFrom: Schema.optionalKey(Schema.String),
  encryptionVersion: Schema.Number,
  isVerified: Schema.Boolean,
  verifiedAt: Schema.optionalKey(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ApiCredential = Schema.Schema.Type<typeof ApiCredential>;

export const DecryptedAgentCredential = Schema.Struct({
  privateKey: RedactedString,
  walletAddress: Schema.String,
  vaultAddress: Schema.optionalKey(Schema.String),
  agentAddress: Schema.String,
  exchange: Schema.String,
  permissions: StringArray,
});
export type DecryptedAgentCredential = Schema.Schema.Type<typeof DecryptedAgentCredential>;

export const DecryptedEoaCredential = Schema.Struct({
  privateKey: RedactedString,
  walletAddress: Schema.String,
  exchange: Schema.String,
});
export type DecryptedEoaCredential = Schema.Schema.Type<typeof DecryptedEoaCredential>;
