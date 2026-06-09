import { Schema } from "effect";

export const CreateWalletSchema = Schema.Struct({
  exchangeSlug: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  walletAddress: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  label: Schema.optional(Schema.String),
});

export const CreateKeySchema = Schema.Struct({
  agentAddress: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  agentPrivateKey: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  label: Schema.optional(Schema.String),
});

// Wallet address validation

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const EVM_EXCHANGES = new Set(["hyperliquid"]);

export const validateWalletAddress = (address: string, exchangeSlug: string): string | null => {
  if (EVM_EXCHANGES.has(exchangeSlug.toLowerCase())) {
    if (!EVM_ADDRESS_RE.test(address)) {
      return "Invalid EVM wallet address format (expected 0x-prefixed 40-char hex)";
    }
  } else {
    // Non-EVM chains (e.g. Solana) use base58
    if (!BASE58_RE.test(address)) {
      return "Invalid wallet address format (expected base58, 32–44 characters)";
    }
  }
  return null;
};
