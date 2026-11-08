import { useEffect } from "react";
import { PortfolioView } from "@/features/portfolio/components/portfolio-view";

export function PortfolioPage() {
  useEffect(() => {
    document.title = "Portfolio | 0xsignal";
  }, []);

  return (
    <div className="container-fluid flex flex-col gap-section page-enter">
      <h1 className="sr-only">Portfolio</h1>
      <PortfolioView />
    </div>
  );
}
