import type { Rule } from "@0xsignal/shared/alerts/index.ts";
import { apiFetch } from "@/lib/api-base";
import { ApiError } from "@/lib/api-error";
import { API_BASE, fetchJson } from "./client";

export type ApiRule = Rule & { id: string; createdAt: string };

export interface AlertPatch {
  enabled?: boolean;
}

export type DeliverySeverity = "info" | "warn" | "critical";

export interface ApiDelivery {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: DeliverySeverity;
  summary: string;
  firedAt: string;
  payload: Record<string, unknown>;
}

export interface AlertDeliveries {
  deliveries: ApiDelivery[];
  unread: number;
}

export type AlertChannel = "telegram";

export interface ChannelRow {
  id: string;
  channel: AlertChannel;
  destination: string;
  label: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  lastSentAt: string | null;
}

export interface AlertChannels {
  channels: ChannelRow[];
  available: Record<AlertChannel, boolean>;
}

export interface ChannelLink {
  code: string;
  expiresAt: string;
  deepLink: string | null;
}

interface AlertListResponse {
  rules: ApiRule[];
}

interface AlertResponse {
  rule: ApiRule;
}

export async function listAlerts(): Promise<ApiRule[]> {
  const { rules } = await fetchJson<AlertListResponse>(`${API_BASE}/alerts`);
  return rules;
}

export async function createAlert(rule: Rule): Promise<ApiRule> {
  const body = await fetchJson<AlertResponse>(`${API_BASE}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rule }),
  });
  return body.rule;
}

export async function updateAlert(id: string, patch: AlertPatch): Promise<ApiRule> {
  const body = await fetchJson<AlertResponse>(`${API_BASE}/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return body.rule;
}

/** A 204 carries no body, so these cannot go through `fetchJson`'s JSON parse. */
function requireOk(response: Response): void {
  if (response.ok) return;
  throw new ApiError(
    `API request failed: ${response.status} ${response.statusText}`.trim(),
    response.status,
    response.statusText,
  );
}

export async function deleteAlert(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/alerts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  requireOk(response);
}

export function listAlertDeliveries(): Promise<AlertDeliveries> {
  return fetchJson<AlertDeliveries>(`${API_BASE}/alerts/deliveries?limit=50`);
}

export async function markAlertDeliveriesSeen(): Promise<void> {
  const response = await apiFetch(`${API_BASE}/alerts/deliveries/seen`, {
    method: "POST",
    credentials: "include",
  });
  requireOk(response);
}

export function listAlertChannels(): Promise<AlertChannels> {
  return fetchJson<AlertChannels>(`${API_BASE}/alerts/channels`);
}

export function createChannelLink(channel: AlertChannel): Promise<ChannelLink> {
  return fetchJson<ChannelLink>(`${API_BASE}/alerts/channels/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel }),
  });
}

export async function deleteAlertChannel(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/alerts/channels/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  requireOk(response);
}

/** A failed test arrives as a 502 with the server's error text, so `fetchJson` throws it. */
export function testAlertChannel(id: string): Promise<{ ok: true }> {
  return fetchJson<{ ok: true }>(`${API_BASE}/alerts/channels/${encodeURIComponent(id)}/test`, {
    method: "POST",
  });
}
