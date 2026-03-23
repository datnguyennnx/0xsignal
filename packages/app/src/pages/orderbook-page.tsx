/**
 * @overview Orderbook Page (Mobile-optimized)
 *
 * Provides a full-screen view of the L2 orderbook for a specific perpetual symbol.
 * Designed for smaller screens where the side-panel in AssetDetail is hidden.
 */
import { useParams, useNavigate } from "react-router-dom";
import { OrderbookWidget } from "@/features/perp/components/orderbook-widget";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderbookPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  // Dynamic document title
  useDocumentTitle({
    title: symbol ? `${symbol.toUpperCase()} Orderbook` : "",
  });

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-1 duration-300 overscroll-none select-none">
      <header className="flex items-center gap-2 px-2 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(`/perp/${symbol}`)}
          className="touch-target-44"
          aria-label="Back to chart"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-mono font-bold tracking-tight">
          {symbol?.toUpperCase()} Orderbook
        </h1>
      </header>
      <div className="flex-1 min-h-0 px-2 pb-2 overscroll-none">
        <OrderbookWidget symbol={symbol || ""} />
      </div>
    </div>
  );
}
