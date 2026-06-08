import { z } from "zod";

export const CreateWalletSchema = z.object({
  exchangeSlug: z.string().min(1),
  walletAddress: z.string().min(1),
  label: z.string().optional(),
});

export const CreateKeySchema = z.object({
  agentAddress: z.string().min(1),
  agentPrivateKey: z.string().min(1),
  label: z.string().optional(),
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
