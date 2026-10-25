import { Schema } from "effect";

const AccountNodeTypeSchema = Schema.Literals(["wallet", "sub", "vault"] as const);

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
  verifiedAt: Schema.optionalKey(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ExchangeAccount = Schema.Schema.Type<typeof ExchangeAccountSchema>;
