import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { JSX } from "react";
import { WhalePositionsTable } from "@/features/whales/components/whale-positions-table";
import { ErrorBoundary } from "@/components/error-boundary";
import { Surface } from "@/components/surface/surface";

export function WhalesPage(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Whales | 0xsignal";
  }, []);

  const handleSelectWallet = (address: string) => {
    void navigate(`/whales/${address}`);
  };

  return (
    <div className="container-fluid space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Whales</h1>
      <ErrorBoundary>
        <Surface tier="content" as="section" className="overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 text-lg font-semibold">Whale Positions</h2>
          <WhalePositionsTable onSelectWallet={handleSelectWallet} />
        </Surface>
      </ErrorBoundary>
    </div>
  );
}
