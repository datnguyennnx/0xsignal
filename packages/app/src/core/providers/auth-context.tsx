import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/services/api";
import { setAuthToken } from "@/lib/api-base";

export interface AuthUser {
  readonly userId: string;
  readonly provider: string;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

type AuthState = {
  /** Whether the user has a valid session */
  readonly isAuthenticated: boolean;
  /** True while checking auth on mount */
  readonly isLoading: boolean;
  /** Authenticated user info (null when not authenticated) */
  readonly user: AuthUser | null;
  /** Whether the user has linked a wallet to their account */
  readonly hasLinkedWallet: boolean;
  /** Re-fetch wallet status and update hasLinkedWallet */
  readonly refreshWalletStatus: () => Promise<void>;
  /** Clear session and reset state */
  readonly signOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasLinkedWallet, setHasLinkedWallet] = useState(false);

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

            // Non-critical wallet check — don't block auth
            try {
              const wallets = await api.listWallets();
              if (!cancelled) {
                setHasLinkedWallet(wallets.length > 0);
              }
            } catch {
              if (!cancelled) {
                setHasLinkedWallet(false);
              }
            }
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
  }, []);

  const signOut = useCallback(() => {
    api.logout().catch(() => {
      /* best-effort */
    });
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
    [isAuthenticated, isLoading, user, hasLinkedWallet, refreshWalletStatus, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
