import type { GlobalMarketData, CryptoPrice } from "@0xsignal/shared";
import { memo } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/core/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { GlobalMarketBar } from "@/features/dashboard/components/global-market-bar";
import { usePrices, useGlobalMarket } from "@/hooks/prices";

interface DashboardContentProps {
  cryptos: CryptoPrice[];
  globalMarket: GlobalMarketData | null;
  fetchedAt?: Date;
}

// Format giá theo độ lớn
const formatPrice = (price: number): string => {
  const config =
    price >= 1000 ? { min: 2, max: 2 } : price >= 1 ? { min: 2, max: 4 } : { min: 4, max: 6 };

  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: config.min,
    maximumFractionDigits: config.max,
  });
};

function DashboardContent({ cryptos, globalMarket }: DashboardContentProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium h-full overflow-y-auto">
      <div className="container-fluid py-4 sm:py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0 mb-5 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-mono font-bold tracking-tight uppercase">
              Market Watchlist
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              Track top cryptocurrencies with real-time price data from CoinGecko.
            </p>
          </div>
          {globalMarket && <GlobalMarketBar data={globalMarket} className="shrink-0 mt-1" />}
        </header>

        {/* Watchlist Table */}
        <section className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    24h Change
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Market Cap
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Volume (24h)
                  </th>
                </tr>
              </thead>
              <tbody>
                {cryptos.map((crypto, index) => (
                  <tr
                    key={crypto.symbol}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        to={`/asset/${crypto.symbol.toLowerCase()}`}
                        className="flex items-center gap-3 group"
                      >
                        <span className="text-xs text-muted-foreground tabular-nums w-6">
                          {index + 1}
                        </span>
                        {crypto.image && (
                          <img
                            src={crypto.image}
                            alt={crypto.symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-mono font-medium text-sm group-hover:text-primary transition-colors">
                            {crypto.symbol.toUpperCase()}
                          </div>
                          {crypto.name && (
                            <div className="text-xs text-muted-foreground">{crypto.name}</div>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-sm tabular-nums">
                        {formatPrice(crypto.price)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={cn(
                          "font-mono text-sm tabular-nums",
                          crypto.change24h >= 0 ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {crypto.change24h >= 0 ? "+" : ""}
                        {crypto.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        ${(crypto.marketCap / 1e9).toFixed(2)}B
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden md:table-cell">
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        ${(crypto.volume24h / 1e9).toFixed(2)}B
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container-fluid py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 sm:mb-6 border-b border-border/40 pb-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 hidden sm:block" />
              <Skeleton className="h-4 w-20 hidden md:block" />
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-24 ml-auto" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24 hidden sm:block" />
                <Skeleton className="h-4 w-24 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export function MarketDashboard() {
  const { data: cryptos, isLoading: pricesLoading, error: pricesError } = usePrices(20);

  const { data: globalMarket, isLoading: marketLoading } = useGlobalMarket();

  const isLoading = pricesLoading || marketLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (pricesError || !cryptos) {
    return (
      <div className="container-fluid py-6 h-full overflow-y-auto">
        <ErrorState type="general" retryAction={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <DashboardContent
      cryptos={cryptos}
      globalMarket={globalMarket || null}
      fetchedAt={new Date()}
    />
  );
}
