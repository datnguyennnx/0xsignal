import { API_BASE, fetchJson } from "./client";

export function createCredential(params: {
  accountId: string;
  agentAddress: string;
  agentPrivateKey: string;
  label?: string;
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
