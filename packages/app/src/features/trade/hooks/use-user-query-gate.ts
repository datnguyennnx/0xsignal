import { useOwnAddress } from "@/hooks/use-effective-address";
import { useAuthStore } from "@/stores/use-auth-store";

const isPresent = (value: string | null | undefined): boolean =>
  value !== null && value !== undefined && value !== "";

/** User data is both wallet-scoped and auth-scoped; either missing half means no request. */
export function useUserQueryGate(enabled: boolean) {
  const ownAddress = useOwnAddress();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return {
    walletAddress: ownAddress ?? "",
    enabled: enabled && isAuthenticated && isPresent(ownAddress),
  };
}
