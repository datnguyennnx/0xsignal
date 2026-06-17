import { API_BASE, fetchJson } from "./client";

export function getAuthMe() {
  return fetchJson<{
    userId: string;
    provider: string;
    avatarUrl: string | null;
    displayName: string | null;
  }>(`${API_BASE}/auth/me`);
}

export function logout() {
  return fetchJson(`${API_BASE}/auth/logout`, {
    method: "POST",
  });
}

export function updateProfile(params: { displayName: string }) {
  return fetchJson<{
    data: {
      userId: string;
      provider: string;
      avatarUrl: string | null;
      displayName: string | null;
    };
  }>(`${API_BASE}/auth/me/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function exchangeCode(code: string) {
  return fetchJson<{
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
  }>(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export function refreshToken() {
  return fetchJson<{
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
  }>(`${API_BASE}/auth/refresh`, {
    method: "POST",
  });
}
