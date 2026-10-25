import { API_BASE, fetchJson } from "./client";

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

export interface WalletChallenge {
  readonly nonce: string;
  readonly message: string;
  readonly expiresAt: string;
}

export function requestWalletChallenge(address: string) {
  return fetchJson<WalletChallenge>(`${API_BASE}/wallets/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
}

export function createWallet(params: {
  walletAddress: string;
  nonce: string;
  signature: string;
  label?: string;
}) {
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
      nonce: params.nonce,
      signature: params.signature,
      label: params.label,
    }),
  });
}

export interface AgentRegistration {
  readonly agentAddress: string;
  readonly label?: string;
  readonly expiresAt?: string;
  readonly isVerified: boolean;
  readonly createdAt: string;
  readonly status: "active" | "expired";
}

export function listAgentRegistrations() {
  return fetchJson<AgentRegistration[]>(`${API_BASE}/wallets/agent-registrations`);
}
