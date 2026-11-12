import { useNavigate } from "react-router";
import type { JSX } from "react";
import { PageShell } from "@/components/page-shell";
import { WhalePositionsTable } from "@/features/whales/components/whale-positions-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { Surface } from "@/components/surface/surface";

export function WhalesPage(): JSX.Element {
  const navigate = useNavigate();

  const handleSelectWallet = (address: string) => {
    void navigate(`/whales/${address}`);
  };

  return (
    <PageShell title="Whales" variant="fill">
      <ErrorBoundary>
        <Surface
          tier="content"
          as="section"
          className="flex flex-1 min-h-0 flex-col overflow-hidden"
        >
          <h2 className="px-4 pt-4 pb-2 type-title font-semibold">Whale Positions</h2>
          <WhalePositionsTable onSelectWallet={handleSelectWallet} />
        </Surface>
      </ErrorBoundary>
    </PageShell>
  );
}
