import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/services/api";
import { setAuthToken, subscribeToken, getToken } from "@/lib/api-base";
import { AuthContext, type AuthState, type AuthUser } from "./auth-types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasLinkedWallet, setHasLinkedWallet] = useState(false);

  // Subscribe to the external token store so React is aware of token changes
  useSyncExternalStore(subscribeToken, getToken);

  const refreshWalletStatus = useCallback(async () => {
    try {
      const wallets = await api.listWallets();
      setHasLinkedWallet(wallets.length > 0);
    } catch {
      // Wallet fetch is non-critical; don't block auth
      setHasLinkedWallet(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Skip refresh on callback/login pages
      if (window.location.pathname === "/auth/callback" || window.location.pathname === "/login") {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.refreshToken();

        if (cancelled) return;

        if (data && data.accessToken) {
          setAuthToken(data.accessToken);
          const profileData = await api.getAuthMe();

          if (cancelled) return;

          if (profileData) {
            setIsAuthenticated(true);
            setUser({
              userId: profileData.userId,
              provider: profileData.provider,
              avatarUrl: profileData.avatarUrl,
              displayName: profileData.displayName,
            });

            await refreshWalletStatus();
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setAuthToken(null);
          setHasLinkedWallet(false);
        }
      } catch (err) {
        if (cancelled) return;

        // Show a toast for 403 (account suspended/deleted)
        if (err instanceof ApiError && err.status === 403) {
          toast.error("Account unavailable", {
            description: "Your account may be suspended or inactive. Please contact support.",
          });
        }

        setIsAuthenticated(false);
        setUser(null);
        setAuthToken(null);
        setHasLinkedWallet(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [refreshWalletStatus]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      console.error("[Auth] Logout error:", err);
      toast.error("Sign out failed", { description: message });
    }
    setAuthToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setHasLinkedWallet(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      hasLinkedWallet,
      refreshWalletStatus,
      signOut,
    }),
    [isAuthenticated, isLoading, user, hasLinkedWallet, refreshWalletStatus, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
