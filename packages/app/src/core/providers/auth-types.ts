import { createContext } from "react";

export interface AuthUser {
  readonly userId: string;
  readonly provider: string;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

export type AuthState = {
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

export const AuthContext = createContext<AuthState | undefined>(undefined);
