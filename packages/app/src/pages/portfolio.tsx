import { useEffect } from "react";
import { PortfolioView } from "@/features/portfolio/components/portfolio-view";

export function PortfolioPage() {
  useEffect(() => {
    document.title = "Portfolio | 0xsignal";
  }, []);

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <h1 className="sr-only">Portfolio</h1>
      <PortfolioView />
    </div>
  );
}
