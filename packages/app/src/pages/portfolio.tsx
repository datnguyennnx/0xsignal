import { PortfolioView } from "@/features/portfolio/components/portfolio-view";

export function PortfolioPage() {
  return (
    <div className="container-fluid flex flex-col gap-section">
      <h1 className="sr-only">Portfolio</h1>
      <PortfolioView />
    </div>
  );
}
