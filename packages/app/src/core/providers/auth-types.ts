import { createContext } from "react";

export interface AuthUser {
  readonly userId: string;
  readonly provider: string;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

export type AuthState = {
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly user: AuthUser | null;
  readonly hasLinkedWallet: boolean;
  readonly refreshWalletStatus: () => Promise<void>;
  readonly signOut: () => void;
};

export const AuthContext = createContext<AuthState | undefined>(undefined);
