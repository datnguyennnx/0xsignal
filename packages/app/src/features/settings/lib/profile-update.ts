import type { AuthMeResponse } from "@0xsignal/shared";

import { useAuthStore } from "@/stores/use-auth-store";

/**
 * Apply the profile response to the live auth store. The response is the
 * canonical account shape, but the store may already hold fields the profile
 * endpoint does not echo, so merge rather than replace.
 */
export function mergeProfileUser(
  current: AuthMeResponse | null,
  updated: AuthMeResponse,
): AuthMeResponse {
  if (current === null) return updated;
  return {
    userId: updated.userId,
    provider: updated.provider,
    avatarUrl: updated.avatarUrl,
    displayName: updated.displayName,
  };
}

export function applyProfileUpdate(updated: AuthMeResponse): void {
  const current = useAuthStore.getState().user;
  if (current === null) return;
  useAuthStore.setState({ user: mergeProfileUser(current, updated) });
}
