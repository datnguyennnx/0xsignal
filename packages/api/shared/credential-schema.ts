import { Schema } from "effect";
import { EVM_ADDRESS_RE } from "./schema";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const EVM_ADDRESS = Schema.String.pipe(
  Schema.check(Schema.isPattern(EVM_ADDRESS_RE, { message: "expected 0x-prefixed 40-char hex" })),
);

export const WalletChallengeRequestSchema = Schema.Struct({
  address: EVM_ADDRESS,
});

const SIGNATURE = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^0x[a-fA-F0-9]{130}$/, { message: "expected a 65-byte hex signature" }),
  ),
);

export const LinkWalletSchema = Schema.Struct({
  exchangeSlug: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  walletAddress: EVM_ADDRESS,
  label: Schema.optional(Schema.String),
  nonce: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  signature: SIGNATURE,
});

const EVM_EXCHANGES = new Set(["hyperliquid"]);

export const validateWalletAddress = (address: string, exchangeSlug: string): string | null => {
  if (EVM_EXCHANGES.has(exchangeSlug.toLowerCase())) {
    if (!EVM_ADDRESS_RE.test(address)) {
      return "Invalid EVM wallet address format (expected 0x-prefixed 40-char hex)";
    }
  } else if (!BASE58_RE.test(address)) {
    // Non-EVM chains (e.g. Solana) use base58
    return "Invalid wallet address format (expected base58, 32–44 characters)";
  }
  return null;
};
