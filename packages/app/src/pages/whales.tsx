import { useNavigate } from "react-router-dom";
import type { JSX } from "react";
import { WhalePositionsTable } from "@/features/whales/components/whale-positions-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { Surface } from "@/components/surface/surface";

export function WhalesPage(): JSX.Element {
  const navigate = useNavigate();

  const handleSelectWallet = (address: string) => {
    void navigate(`/whales/${address}`);
  };

  return (
    <div className="container-fluid flex flex-1 min-h-0 flex-col gap-section">
      <h1 className="sr-only">Whales</h1>
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
    </div>
  );
}
