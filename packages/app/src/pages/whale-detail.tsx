import { Navigate, useParams } from "react-router";
import { PageShell } from "@/components/page-shell";
import { isValidAddress } from "@/core/utils/address";
import { useWhaleStreamBridge } from "@/features/portfolio/hooks/use-portfolio-data";
import { PortfolioWhaleView } from "@/features/portfolio/components/portfolio-whale-view";

/**
 * Read-only portfolio for a third-party wallet. The address comes from the route
 * and is passed down as a prop; it is never written to a store or an auth call.
 */
export function WhaleDetailPage() {
  const { address } = useParams<{ address: string }>();
  const selected = address !== undefined && isValidAddress(address) ? address : undefined;

  useWhaleStreamBridge(selected);

  if (selected === undefined) return <Navigate to="/whales" replace />;

  return (
    <PageShell title="Whale portfolio" variant="fill">
      <PortfolioWhaleView address={selected} />
    </PageShell>
  );
}
