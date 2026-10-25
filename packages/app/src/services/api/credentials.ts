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
