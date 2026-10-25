import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import { toast } from "sonner";
import { api } from "@/services/api";
import type { AuthMeResponse } from "@0xsignal/shared";
import { ApiError } from "@/lib/api-error";
import { registerAuthTokenBridge } from "@/lib/auth-token";

export interface PersistedAuthState {
  user: AuthMeResponse | null;
  hasLinkedWallet: boolean;
}

export function selectPersistedAuthState(state: AuthStoreState): PersistedAuthState {
  return {
    user: state.user,
    hasLinkedWallet: state.hasLinkedWallet,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthMeResponse(value: unknown): value is AuthMeResponse {
  return (
    isRecord(value) &&
    typeof value["userId"] === "string" &&
    typeof value["provider"] === "string" &&
    (value["avatarUrl"] === null || typeof value["avatarUrl"] === "string") &&
    (value["displayName"] === null || typeof value["displayName"] === "string")
  );
}

/** Persisted rows may retain the old access token; it must never re-enter the live store. */
export function mergePersistedAuthState(
  persisted: unknown,
  current: AuthStoreState,
): AuthStoreState {
  const record = isRecord(persisted) ? persisted : {};
  return {
    ...current,
    token: null,
    isAuthenticated: false,
    user: isAuthMeResponse(record["user"]) ? record["user"] : null,
    hasLinkedWallet: record["hasLinkedWallet"] === true,
  };
}

export interface AuthStoreState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthMeResponse | null;
  hasLinkedWallet: boolean;
  hasUnverifiedWallet: boolean;
  tokenExpiresAt: number | null;

  // Actions
  setToken: (token: string | null) => void;
  setUser: (user: AuthMeResponse | null) => void;
  setLoading: (loading: boolean) => void;
  setHasLinkedWallet: (linked: boolean) => void;
  signOut: () => Promise<void>;
  refreshWalletStatus: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        token: null,
        isAuthenticated: false,
        isLoading: true,
        user: null,
        hasLinkedWallet: false,
        hasUnverifiedWallet: false,
        tokenExpiresAt: null,

        setToken: (token: string | null) => {
          set({ token, isAuthenticated: token !== null });
        },

        setUser: (user: AuthMeResponse | null) => {
          set({ user });
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        setHasLinkedWallet: (linked: boolean) => {
          set({ hasLinkedWallet: linked });
        },

        signOut: async () => {
          try {
            await api.logout();
          } catch (err) {
            console.error("[Auth] Logout error:", err);
            toast.error("Sign out failed", { description: "Try again to sign out." });
          }
          set({
            token: null,
            isAuthenticated: false,
            user: null,
            hasLinkedWallet: false,
            hasUnverifiedWallet: false,
            isLoading: false,
          });
        },

        refreshWalletStatus: async () => {
          try {
            const wallets = await api.listWallets();
            set({
              hasLinkedWallet: wallets.length > 0,
              hasUnverifiedWallet: wallets.some((wallet) => !wallet.verified),
            });
          } catch {
            // Wallet fetch is non-critical; don't block auth
            set({ hasLinkedWallet: false, hasUnverifiedWallet: false });
          }
        },

        initialize: () => {
          let cancelled = false;

          void (async () => {
            // Skip refresh on callback/login pages
            if (
              typeof window !== "undefined" &&
              (window.location.pathname === "/auth/callback" ||
                window.location.pathname === "/login")
            ) {
              if (!cancelled) set({ isLoading: false });
              return;
            }

            try {
              const data = await api.refreshToken();

              const token = data?.accessToken;
              if (token !== undefined && token !== "") {
                // The token only lives in memory, so it must be written before any
                // authenticated request (including /auth/me) is issued.
                if (!cancelled) set({ token, isAuthenticated: true });
                const profileData = await api.getAuthMe();

                if (profileData !== null) {
                  if (cancelled) return;
                  const user: AuthMeResponse = {
                    userId: profileData.userId,
                    provider: profileData.provider,
                    avatarUrl: profileData.avatarUrl,
                    displayName: profileData.displayName,
                  };
                  set({ user });

                  // Fetch wallet status after successful auth
                  if (!cancelled) await get().refreshWalletStatus();
                }
              } else if (!cancelled) {
                set({
                  token: null,
                  isAuthenticated: false,
                  user: null,
                  hasLinkedWallet: false,
                  hasUnverifiedWallet: false,
                });
              }
            } catch (err) {
              if (cancelled) return;
              // Show a toast for 403 (account suspended/deleted)
              if (err instanceof ApiError && err.status === 403) {
                toast.error("Account unavailable", {
                  description: "Your account may be suspended or inactive. Please contact support.",
                });
              }

              set({
                token: null,
                isAuthenticated: false,
                user: null,
                hasLinkedWallet: false,
                hasUnverifiedWallet: false,
              });
            } finally {
              if (!cancelled) set({ isLoading: false });
            }
          })();

          return () => {
            cancelled = true;
          };
        },
      }),
      {
        name: "auth-store",
        partialize: (state) => selectPersistedAuthState(state),
        merge: (persisted, current) => mergePersistedAuthState(persisted, current),
        onRehydrateStorage: () => (state) => {
          // Rewrite the persisted row so a token written by an older build is scrubbed.
          state?.setToken(null);
        },
      },
    ),
  ),
);

registerAuthTokenBridge({
  read: () => useAuthStore.getState().token,
  write: (token) => {
    useAuthStore.getState().setToken(token);
  },
});
