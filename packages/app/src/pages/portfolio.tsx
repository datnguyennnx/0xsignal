import { PageShell } from "@/components/page-shell";
import { PortfolioView } from "@/features/portfolio/components/portfolio-view";

export function PortfolioPage() {
  return (
    <PageShell title="Portfolio" variant="flow">
      <PortfolioView />
    </PageShell>
  );
}
