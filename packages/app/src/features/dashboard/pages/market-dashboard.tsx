import type { GlobalMarketData, CryptoPrice } from "@0xsignal/shared";
import { memo, useState, useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { GlobalMarketBar } from "@/features/dashboard/components/global-market-bar";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePrices, useGlobalMarket } from "@/hooks/prices";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Sparkline } from "@/components/sparkline";

const PAGE_SIZE = 20;
const MAX_ITEMS = 100;

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

const formatMarketCap = (value: number): string => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const formatVolume = (value: number): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

const ChangeCell = memo(function ChangeCell({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        isPositive ? "text-green-500" : "text-red-500"
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
});

interface DashboardContentProps {
  cryptos: CryptoPrice[];
  globalMarket: GlobalMarketData | null;
  totalCryptos: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const DashboardContent = memo(function DashboardContent({
  cryptos,
  globalMarket,
  totalCryptos,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DashboardContentProps) {
  const totalPages = Math.ceil(totalCryptos / pageSize);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium h-full overflow-y-auto">
      <div className="container-fluid py-4 sm:py-6">
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

        <section className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[140px]">Coin</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">1h</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">7d</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Market Cap</TableHead>
                <TableHead className="text-right hidden md:table-cell">Volume (24h)</TableHead>
                <TableHead className="text-right">Last 7 Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cryptos.map((crypto, index) => (
                <TableRow key={crypto.symbol} className="hover:bg-muted/20">
                  <TableCell>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {(page - 1) * pageSize + index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {crypto.image && (
                        <img
                          src={crypto.image}
                          alt={crypto.symbol}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-sm">
                          {crypto.symbol.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {crypto.name}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm tabular-nums">
                      {formatPrice(crypto.price)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={crypto.change1h} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={crypto.change24h} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={crypto.change7d} />
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {formatMarketCap(crypto.marketCap)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      ${formatVolume(crypto.volume24h)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Sparkline data={crypto.sparkline7d} positive={crypto.change7d >= 0} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCryptos}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </section>
      </div>
    </div>
  );
});

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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[140px]">Coin</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">1h</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">7d</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Market Cap</TableHead>
                <TableHead className="text-right hidden md:table-cell">Volume (24h)</TableHead>
                <TableHead className="text-right">Last 7 Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-6" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
});

export function MarketDashboard() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useDocumentTitle({ title: "Market Watchlist" });

  const { data: cryptos, isLoading: pricesLoading, error: pricesError } = usePrices(MAX_ITEMS);
  const { data: globalMarket, isLoading: marketLoading } = useGlobalMarket();

  const totalCryptos = useMemo(() => cryptos?.length || 16642, [cryptos]);

  const paginatedCryptos = useMemo(
    () => cryptos?.slice((page - 1) * pageSize, page * pageSize) || [],
    [cryptos, page, pageSize]
  );

  const isLoading = pricesLoading || marketLoading;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

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
      cryptos={paginatedCryptos}
      globalMarket={globalMarket || null}
      totalCryptos={totalCryptos}
      page={page}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
    />
  );
}
