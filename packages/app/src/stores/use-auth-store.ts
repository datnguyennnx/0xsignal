import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";
import { toast } from "sonner";
import { api, ApiError } from "@/services/api";
import type { AuthMeResponse } from "@0xsignal/shared";

export interface AuthStoreState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthMeResponse | null;
  hasLinkedWallet: boolean;
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
            const message = err instanceof Error ? err.message : "Sign out failed";
            console.error("[Auth] Logout error:", err);
            toast.error("Sign out failed", { description: message });
          }
          set({
            token: null,
            isAuthenticated: false,
            user: null,
            hasLinkedWallet: false,
            isLoading: false,
          });
        },

        refreshWalletStatus: async () => {
          try {
            const wallets = await api.listWallets();
            set({ hasLinkedWallet: wallets.length > 0 });
          } catch {
            // Wallet fetch is non-critical; don't block auth
            set({ hasLinkedWallet: false });
          }
        },

        initialize: () => {
          let cancelled = false;

          (async () => {
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

              if (data && data.accessToken) {
                const profileData = await api.getAuthMe();

                if (profileData) {
                  if (cancelled) return;
                  const user: AuthMeResponse = {
                    userId: profileData.userId,
                    provider: profileData.provider,
                    avatarUrl: profileData.avatarUrl,
                    displayName: profileData.displayName,
                  };
                  set({
                    token: data.accessToken,
                    isAuthenticated: true,
                    user,
                  });

                  // Fetch wallet status after successful auth
                  if (!cancelled) await get().refreshWalletStatus();
                }
              } else {
                if (!cancelled) {
                  set({
                    token: null,
                    isAuthenticated: false,
                    user: null,
                    hasLinkedWallet: false,
                  });
                }
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
        partialize: (state) => ({
          user: state.user,
          hasLinkedWallet: state.hasLinkedWallet,
        }),
      },
    ),
  ),
);
