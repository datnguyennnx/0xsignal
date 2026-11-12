import { useAuthStore } from "@/stores/use-auth-store";

export type ApiConsoleView = "connect" | "loading" | "signin" | "link" | "form";

export interface ApiConsoleViewInput {
  isConnected: boolean;
  isAuthenticated: boolean;
  hasLinkedWallet: boolean;
}

export function useApiConsoleView({
  isConnected,
  isAuthenticated,
  hasLinkedWallet,
}: ApiConsoleViewInput): ApiConsoleView {
  const isResolving = useAuthStore((s) => s.isLoading);

  if (!isConnected) return "connect";
  if (isResolving) return "loading";
  if (!isAuthenticated) return "signin";
  if (!hasLinkedWallet) return "link";
  return "form";
}
