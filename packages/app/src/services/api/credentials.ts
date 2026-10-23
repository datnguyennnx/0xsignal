import { privateKeyToAccount } from "viem/accounts";
import { API_BASE, fetchJson } from "./client";

function isHexPrivateKey(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/** Derives the agent wallet address from a Hyperliquid API key without a second normalization rule. */
export function deriveAgentAddress(privateKey: string): string {
  const trimmed = privateKey.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!isHexPrivateKey(prefixed)) {
    throw new Error("Invalid Hyperliquid API key format");
  }
  return privateKeyToAccount(prefixed).address;
}

export function createCredential(params: {
  accountId: string;
  agentAddress: string;
  agentPrivateKey: string;
  label?: string | undefined;
}) {
  return fetchJson<{
    credentialId: string;
    agentAddress: string;
    isVerified: boolean;
  }>(`${API_BASE}/wallets/${params.accountId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentAddress: params.agentAddress,
      agentPrivateKey: params.agentPrivateKey,
      label: params.label,
    }),
  });
}

export function listWallets() {
  return fetchJson<
    Array<{
      id: string;
      walletAddress: string;
      label: string;
      isPrimary: boolean;
    }>
  >(`${API_BASE}/wallets`);
}

export function createWallet(params: { walletAddress: string; label?: string }) {
  return fetchJson<{
    accountId: string;
    walletAddress: string;
    isPrimary: boolean;
  }>(`${API_BASE}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exchangeSlug: "hyperliquid",
      walletAddress: params.walletAddress,
      label: params.label,
    }),
  });
}
