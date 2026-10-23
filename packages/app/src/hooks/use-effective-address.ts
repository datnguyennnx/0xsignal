import { useConnection } from "wagmi";
import { useAppStore } from "@/stores/use-app-store";

export function useEffectiveAddress(): string | undefined {
  const activeAddress = useAppStore((s) => s.activeAddress);
  const { address: connectedAddress } = useConnection();
  return activeAddress ?? connectedAddress;
}

export function useIsSigningDisabled(): boolean {
  const activeAddress = useAppStore((s) => s.activeAddress);
  const { address: connectedAddress } = useConnection();
  return (
    activeAddress != null && activeAddress.toLowerCase() !== (connectedAddress?.toLowerCase() ?? "")
  );
}
