import { useEffect } from "react";
import type { JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WhalePositionsTable } from "@/features/whales";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAppStore } from "@/stores/use-app-store";

export function WhalesPage(): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const setActiveAddress = useAppStore((s) => s.setActiveAddress);

  useEffect(() => {
    document.title = "Whales | 0xsignal";
  }, []);

  const handleSelectWallet = (address: string) => {
    setActiveAddress(address);
    navigate(`/whales/${address}`);
  };

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Whales</h1>
      <ErrorBoundary resetKey={pathname}>
        <section className="overflow-hidden rounded-xl material-raised">
          <h2 className="px-4 pt-4 pb-2 text-lg font-semibold">Whale Positions</h2>
          <WhalePositionsTable onSelectWallet={handleSelectWallet} />
        </section>
      </ErrorBoundary>
    </div>
  );
}
