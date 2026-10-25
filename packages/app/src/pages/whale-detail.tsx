import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { isValidAddress } from "@/core/utils/address";
import { useAppStore } from "@/stores/use-app-store";

// Old /whales/:address links still resolve; the address moves into the store so /portfolio
// renders that wallet instead of whichever address was active before.
export function WhaleAddressRedirect() {
  const { address } = useParams<{ address: string }>();
  const setActiveAddress = useAppStore((s) => s.setActiveAddress);
  const hasValidAddress = address !== undefined && address !== "" && isValidAddress(address);

  useEffect(() => {
    if (hasValidAddress && address !== undefined) setActiveAddress(address);
  }, [address, hasValidAddress, setActiveAddress]);

  return <Navigate to={hasValidAddress ? "/portfolio" : "/whales"} replace />;
}
