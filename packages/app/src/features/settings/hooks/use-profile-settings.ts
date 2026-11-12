import type { AuthMeResponse } from "@0xsignal/shared";

import { useAuthStore } from "@/stores/use-auth-store";

export type ProfileState =
  | { status: "loading" }
  | { status: "idle" }
  | { status: "ready"; data: AuthMeResponse };

function toProfileState(user: AuthMeResponse | null, isResolving: boolean): ProfileState {
  if (isResolving) return { status: "loading" };
  if (user === null) return { status: "idle" };
  return { status: "ready", data: user };
}

export interface ProfileSettingsState {
  state: ProfileState;
  signOut: () => Promise<void>;
}

export function useProfileSettings(): ProfileSettingsState {
  const user = useAuthStore((s) => s.user);
  const isResolving = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);

  return { state: toProfileState(user, isResolving), signOut };
}
