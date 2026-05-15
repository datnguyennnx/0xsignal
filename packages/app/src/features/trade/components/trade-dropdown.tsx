/**
 * Market selector dropdown. Searchable, sortable, category-filtered.
 * Fetches via useTradeList, navigates to /trade/:rawCoin on select.
 */
import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ContentUnavailable } from "@/components/content-unavailable";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils/cn";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { calculatePxDecimals } from "@/features/trade/hooks/use-hyperliquid-meta";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatSize } from "@/core/utils/formatters";

interface TradeDropdownProps {
  currentSymbol: string;
  logoUrl?: string;
  displaySymbol?: string;
  currentDisplayName?: string;
  /** Called when user shows intent to open dropdown (hover) — triggers lazy markets fetch. */
  onPrefetchMarkets?: () => void;
}

interface FormattedTrade {
  readonly coin: string;
  readonly rawCoin: string;
  readonly marketType: "perp" | "spot" | "outcome";
  readonly displaySymbol: string;
  readonly displayCategory: string;
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly dayNtlVlm: string;
  readonly isHip3: boolean;
  readonly category: string;
  readonly dexPrefix: string | null;
  readonly changeValue: number;
  readonly changeFormatted: string;
  readonly oiFormatted: string;
  readonly isActive: boolean;
  readonly pxDecimals: number;
}

const TAB_ORDER = [
  "All",
  "Perps",
  "Spot",
  "Outcome",
  "Crypto",
  "Tradfi",
  "HIP-3",
  "Trending",
  "Pre-launch",
] as const;
type CategoryTab =
  | "all"
  | "perps"
  | "spot"
  | "outcome"
  | "crypto"
  | "tradfi"
  | "hip3"
  | "trending"
  | "prelaunch";

const TAB_TO_CATEGORY: Record<string, CategoryTab> = {
  All: "all",
  Perps: "perps",
  Spot: "spot",
  Outcome: "outcome",
  Crypto: "crypto",
  Tradfi: "tradfi",
  "HIP-3": "hip3",
  Trending: "trending",
  "Pre-launch": "prelaunch",
};

const SortIcon = ({
  sortBy,
  sortField,
  sortDesc,
}: {
  sortBy: "name" | "change";
  sortField: "name" | "change";
  sortDesc: boolean;
}) => {
  const isActive = sortBy === sortField;
  if (sortField === "change" && isActive) {
    return sortDesc ? (
      <ArrowDown className="w-3 h-3 text-gain" />
    ) : (
      <ArrowUp className="w-3 h-3 text-loss" />
    );
  }
  if (isActive) {
    return sortDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  }
  return <ArrowUpDown className="w-3 h-3 opacity-50" />;
};

const MarketHeader = ({
  sortBy,
  sortDesc,
  onSort,
}: {
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
}) => (
  <div className="grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
    <button
      type="button"
      onClick={() => onSort("name")}
      className="text-left hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
    >
      Market
      <SortIcon sortBy={sortBy} sortField="name" sortDesc={sortDesc} />
    </button>
    <span className="text-right tabular-nums font-mono">Price</span>
    <button
      type="button"
      onClick={() => onSort("change")}
      className="text-right hover:text-foreground transition-colors flex items-center justify-end gap-1 cursor-pointer bg-transparent border-none p-0"
    >
      24h
      <SortIcon sortBy={sortBy} sortField="change" sortDesc={sortDesc} />
    </button>
    <span className="text-right tabular-nums font-mono">OI</span>
  </div>
);

const MarketRow = ({ item }: { item: FormattedTrade }) => (
  <div className="grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-3">
    <div className="flex flex-col justify-center min-w-0">
      <span className="font-mono font-medium text-sm tabular-nums truncate">
        {item.displaySymbol}
      </span>
      <span className="text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] text-muted-foreground uppercase opacity-70">
        {item.displayCategory}
      </span>
    </div>
    <span className="font-mono text-sm text-right flex items-center justify-end text-foreground tabular-nums">
      {formatPrice(Number(item.markPx), item.pxDecimals)}
    </span>
    <span
      className={cn(
        "font-mono text-sm text-right flex items-center justify-end tabular-nums",
        item.changeValue >= 0 ? "text-gain" : "text-loss"
      )}
    >
      {item.changeFormatted}
    </span>
    <span className="font-mono text-xs text-right flex items-center justify-end text-muted-foreground tabular-nums">
      {item.oiFormatted}
    </span>
  </div>
);

const MarketRowSkeleton = () => (
  <div className="grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-3">
    <Skeleton className="h-4 w-16" />
    <Skeleton className="h-4 w-14 ml-auto" />
    <Skeleton className="h-4 w-12 ml-auto" />
    <Skeleton className="h-4 w-14 ml-auto" />
  </div>
);

export const TradeDropdown = memo(function TradeDropdown({
  currentSymbol,
  logoUrl,
  displaySymbol,
  currentDisplayName,
  onPrefetchMarkets,
}: TradeDropdownProps) {
  const dropdownContentId = "trade-market-dropdown-content";
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [sortBy, setSortBy] = useState<"name" | "change">("name");
  const [sortDesc, setSortDesc] = useState(false); // default A-Z
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, error } = useTradeList();

  const displayLabel = currentDisplayName || displaySymbol || currentSymbol;

  const trades = data?.assets;

  const filteredTrades = useMemo(() => {
    if (!trades) return [];

    let filtered = trades;

    if (category !== "all") {
      if (category === "perps") {
        filtered = filtered.filter((f) => f.marketType === "perp");
      } else if (category === "spot") {
        filtered = filtered.filter((f) => f.marketType === "spot");
      } else if (category === "outcome") {
        filtered = filtered.filter((f) => f.marketType === "outcome");
      } else if (category === "tradfi") {
        filtered = filtered.filter((f) =>
          ["stocks", "forex", "commodities", "indices"].includes(f.category)
        );
      } else if (category === "hip3") {
        filtered = filtered.filter((f) => f.isHip3);
      } else if (category === "trending") {
        filtered = [...filtered]
          .sort((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm))
          .slice(0, 10);
      } else {
        filtered = filtered.filter((f) => f.category === category);
      }
    }

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (f) => f.coin.toLowerCase().includes(q) || f.displaySymbol.toLowerCase().includes(q)
      );
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return sortDesc ? b.coin.localeCompare(a.coin) : a.coin.localeCompare(b.coin);
      }
      const changeA = a.prevDayPx
        ? (Number(a.markPx) - Number(a.prevDayPx)) / Number(a.prevDayPx)
        : 0;
      const changeB = b.prevDayPx
        ? (Number(b.markPx) - Number(b.prevDayPx)) / Number(b.prevDayPx)
        : 0;
      return sortDesc ? changeB - changeA : changeA - changeB;
    });

    return filtered;
  }, [trades, category, query, sortBy, sortDesc]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = 8;
      let top = rect.bottom + 8;

      if (viewportWidth >= 640) {
        left = Math.max(8, rect.left);
        if (left + 440 > viewportWidth) {
          left = viewportWidth - 450;
        }
      }

      const dropdownHeight = 520;
      if (top + dropdownHeight > viewportHeight - 20) {
        top = rect.top - dropdownHeight - 8;
      }
      if (top < 20) {
        top = 20;
      }

      setPosition({ top, left });
    }
    setIsOpen(true);
  }, []);

  const handleSelect = useCallback(
    (asset: { rawCoin: string }) => {
      navigate(`/trade/${asset.rawCoin}`);
      handleClose();
    },
    [navigate, handleClose]
  );

  const handleSort = useCallback(
    (field: "name" | "change") => {
      if (sortBy === field) {
        setSortDesc((prev) => !prev);
      } else {
        setSortBy(field);
        setSortDesc(true);
      }
    },
    [sortBy]
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-trade-dropdown]")) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const formattedTrades = useMemo(() => {
    if (!filteredTrades) return [];
    const currentRawCoinLower = currentSymbol.toLowerCase();
    return filteredTrades.map((item) => {
      const prevPx = Number(item.prevDayPx);
      const markPx = Number(item.markPx);
      const change = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;
      const oi = Number(item.openInterest);
      const pxDec = calculatePxDecimals(item.szDecimals ?? 4);
      return {
        coin: item.coin,
        rawCoin: item.rawCoin,
        marketType: item.marketType,
        displaySymbol: item.displaySymbol,
        displayCategory: item.displayCategory,
        markPx: item.markPx,
        prevDayPx: item.prevDayPx,
        openInterest: item.openInterest,
        dayNtlVlm: item.dayNtlVlm,
        isHip3: item.isHip3,
        category: item.category,
        dexPrefix: item.dexPrefix,
        changeValue: change,
        changeFormatted: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
        oiFormatted: formatSize(oi),
        isActive: item.rawCoin.toLowerCase() === currentRawCoinLower,
        pxDecimals: pxDec,
      };
    });
  }, [filteredTrades, currentSymbol]);

  return (
    <div className="relative" data-trade-dropdown>
      <button
        type="button"
        ref={triggerRef}
        className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition-colors hover:bg-muted/30"
        onClick={isOpen ? handleClose : handleOpen}
        onMouseEnter={onPrefetchMarkets}
        onFocus={onPrefetchMarkets}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={dropdownContentId}
        aria-label={`Select market, current ${displayLabel}`}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="w-5 h-5 rounded-full shrink-0"
            loading="eager"
            decoding="async"
          />
        )}
        {displaySymbol ? (
          <div className="flex items-baseline gap-0">
            <span className="text-lg sm:text-xl font-mono font-semibold text-foreground tabular-nums">
              {displaySymbol.split("-")[0]}
            </span>
            <span className="text-lg sm:text-xl font-mono font-medium text-foreground/70">
              -{displaySymbol.split("-").slice(1).join("-")}
            </span>
          </div>
        ) : (
          <span className="text-lg sm:text-xl font-mono font-semibold text-foreground tabular-nums">
            {displayLabel}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          id={dropdownContentId}
          role="dialog"
          aria-modal="false"
          aria-label="Market selector"
          className="fixed z-50 w-[calc(100vw-16px)] sm:w-[clamp(22rem,80vw,27.5rem)] bg-background border-border/30 rounded-xl shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search market..."
                className="pl-9 pr-8 bg-muted/30 border-border h-10 text-sm rounded-xl focus:ring-1 focus:ring-offset-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground/60 hover:text-foreground bg-transparent border-none cursor-pointer tap-highlight"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex px-2 overflow-x-auto border-b border-border/20 scrollbar-hide">
            {TAB_ORDER.map((tab) => {
              const catKey = TAB_TO_CATEGORY[tab];
              const isActive = category === catKey;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCategory(catKey)}
                  className={cn(
                    "px-3 py-2 text-[clamp(0.6875rem,0.7rem+0.4vw,0.75rem)] font-medium whitespace-nowrap transition-colors cursor-pointer bg-transparent border-none border-b-2 -mb-px",
                    isActive
                      ? "text-foreground border-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground border-transparent"
                  )}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <MarketHeader sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} />

          <div className="max-h-[clamp(22rem,60dvh,34rem)] overflow-y-auto overscroll-none flex flex-col">
            {isLoading ? (
              <div className="divide-y divide-border/30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="divide-y divide-border/30">
                    <MarketRowSkeleton />
                  </div>
                ))}
              </div>
            ) : error ? (
              <ContentUnavailable
                variant="error"
                title="Failed to Load"
                description="Could not retrieve market data. Please try again."
              />
            ) : formattedTrades.length === 0 ? (
              <ContentUnavailable
                variant="no-data"
                title="No Markets Found"
                description="No markets match your current filters."
              />
            ) : (
              <div className="divide-y divide-border/30">
                {formattedTrades.map((item) => (
                  <button
                    key={`${item.coin}-${item.dexPrefix ?? "main"}-${item.marketType}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset cursor-pointer select-none tap-highlight",
                      item.isActive && "bg-muted/60"
                    )}
                    aria-current={item.isActive ? "true" : undefined}
                  >
                    <MarketRow item={item} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
