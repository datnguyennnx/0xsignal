import { useParams } from "react-router-dom";
import { useConnection } from "wagmi";
import { selectAccountView, type AccountView } from "@/hooks/account-view";

function useAccountView(): AccountView {
  const { address } = useConnection();
  const { address: routeAddress } = useParams<{ address: string }>();
  return selectAccountView({ routeAddress, connectionAddress: address });
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
