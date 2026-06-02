/**
 * @overview Auth Context Provider
 *
 * Manages in-memory access token storage and handles silent session
 * refreshing via secure HTTP-only cookies.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { api, setAuthToken } from "@/services/api";

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
  /** Clear session and reset state */
  readonly signOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // Skip silent refresh if on callback or login landing pages to optimize load times
      if (window.location.pathname === "/auth/callback" || window.location.pathname === "/login") {
        setIsLoading(false);
        return;
      }

      try {
        // Perform a silent refresh to exchange httpOnly cookie for in-memory access token
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
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setAuthToken(null);
        }
      } catch (error) {
        if (cancelled) return;
        setIsAuthenticated(false);
        setUser(null);
        setAuthToken(null);
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
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      signOut,
    }),
    [isAuthenticated, isLoading, user, signOut]
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
