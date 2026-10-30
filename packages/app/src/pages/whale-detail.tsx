import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { isValidAddress } from "@/core/utils/address";
import { PortfolioView } from "@/features/portfolio/components/portfolio-view";

/**
 * Read-only portfolio for a third-party wallet. The address comes from the route
 * and is passed down as a prop; it is never written to a store or an auth call.
 */
export function WhaleDetailPage() {
  const { address } = useParams<{ address: string }>();
  const selected = address !== undefined && isValidAddress(address) ? address : undefined;

  useEffect(() => {
    document.title = "Whale | 0xsignal";
  }, []);

  if (selected === undefined) return <Navigate to="/whales" replace />;

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Whale portfolio</h1>
      <PortfolioView readOnlyAddress={selected} />
    </div>
  );
}
