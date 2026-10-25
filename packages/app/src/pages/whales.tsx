import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { JSX } from "react";
import { WhalePositionsTable } from "@/features/whales/components/whale-positions-table";
import { ErrorBoundary } from "@/components/error-boundary";

export function WhalesPage(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Whales | 0xsignal";
  }, []);

  const handleSelectWallet = (address: string) => {
    void navigate(`/whales/${address}`);
  };

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Whales</h1>
      <ErrorBoundary>
        <section className="overflow-hidden rounded-[var(--radius-panel)] tier-content">
          <h2 className="px-4 pt-4 pb-2 text-lg font-semibold">Whale Positions</h2>
          <WhalePositionsTable onSelectWallet={handleSelectWallet} />
        </section>
      </ErrorBoundary>
    </div>
  );
}
