import { EmptyState } from "@/components/empty-state";
import { Surface } from "@/components/surface/surface";

import type { PortfolioSummaryGateState } from "../utils/summary-derivations";
import { SURFACE } from "./portfolio-summary.constants";
import { PortfolioSummaryError, PortfolioSummarySkeleton } from "./portfolio-summary-sections";

export function PortfolioSummaryConnectWalletState() {
  return (
    <Surface tier="content" className={SURFACE}>
      <EmptyState
        variant="panel"
        title="Connect your wallet"
        description="Connect your wallet to see your portfolio."
      />
    </Surface>
  );
}

/** Renders every non-ready summary state; the ready surface stays in the card. */
export function PortfolioSummaryGate({
  state,
  onRetry,
}: {
  state: Exclude<PortfolioSummaryGateState, "ready">;
  onRetry?: (() => void) | undefined;
}) {
  if (state === "connect-wallet") return <PortfolioSummaryConnectWalletState />;
  if (state === "error") return <PortfolioSummaryError onRetry={onRetry} />;
  return <PortfolioSummarySkeleton />;
}
