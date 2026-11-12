import { useParams } from "react-router";
import { useWalletAddress } from "@/components/wallet-provider";
import { selectAccountView, type AccountView } from "@/hooks/account-view";

function useAccountView(): AccountView {
  const connectionAddress = useWalletAddress();
  const { address: routeAddress } = useParams<{ address: string }>();
  return selectAccountView({ routeAddress, connectionAddress });
}

export function useOwnAddress(): string | undefined {
  return useAccountView().ownAddress;
}

export function useWhaleAddress(): string | undefined {
  return useAccountView().whaleAddress;
}

export function useIsSigningDisabled(): boolean {
  return useAccountView().signingDisabled;
}
