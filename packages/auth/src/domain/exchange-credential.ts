import { Schema, SchemaGetter } from "effect";
import * as RedactedNs from "effect/Redacted";
import type { Redacted } from "effect/Redacted";

const AccountNodeTypeSchema = Schema.Literals(["wallet", "sub", "vault"] as const);

const CredentialSubtypeSchema = Schema.Literals(["agent", "eoa", "hardware"] as const);

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

const ExchangeAccountSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  exchangeId: Schema.String,
  nodeType: AccountNodeTypeSchema,
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
export type ExchangeAccount = Schema.Schema.Type<typeof ExchangeAccountSchema>;

// enc_* fields are ciphertext

const ApiCredentialSchema = Schema.Struct({
  id: Schema.String,
  accountId: Schema.String,
  userId: Schema.String,
  credentialSubtype: CredentialSubtypeSchema,
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
export type ApiCredential = Schema.Schema.Type<typeof ApiCredentialSchema>;

const DecryptedAgentCredentialSchema = Schema.Struct({
  privateKey: RedactedString,
  walletAddress: Schema.String,
  vaultAddress: Schema.optionalKey(Schema.String),
  agentAddress: Schema.String,
  exchange: Schema.String,
  permissions: StringArray,
});
export type DecryptedAgentCredential = Schema.Schema.Type<typeof DecryptedAgentCredentialSchema>;

const DecryptedEoaCredentialSchema = Schema.Struct({
  privateKey: RedactedString,
  walletAddress: Schema.String,
  exchange: Schema.String,
});
export type DecryptedEoaCredential = Schema.Schema.Type<typeof DecryptedEoaCredentialSchema>;
