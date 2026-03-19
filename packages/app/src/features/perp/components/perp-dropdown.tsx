import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ContentUnavailable } from "@/components/content-unavailable";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils/cn";
import { usePerpList } from "@/hooks/use-perp-list";
import { Skeleton } from "@/components/ui/skeleton";

interface PerpDropdownProps {
  currentSymbol: string;
}

interface FormattedPerp {
  coin: string;
  category: string;
  markPx: string;
  prevDayPx: string;
  openInterest: string;
  changeValue: number;
  changeFormatted: string;
  oiFormatted: string;
  isActive: boolean;
}

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
  <div className="hidden sm:grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
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

const MarketHeaderMobile = ({
  sortBy,
  sortDesc,
  onSort,
}: {
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
}) => (
  <div className="sm:hidden grid min-w-0 grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
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
  </div>
);

const MarketRowDesktop = ({ item }: { item: FormattedPerp }) => (
  <div className="hidden sm:grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-3">
    <div className="flex flex-col justify-center min-w-0">
      <span className="font-mono font-medium text-sm tabular-nums">{item.coin}</span>
      <span className="text-[10px] text-muted-foreground capitalize">{item.category}</span>
    </div>
    <span className="font-mono text-sm text-right flex items-center justify-end text-foreground tabular-nums">
      ${formatPrice(item.markPx)}
    </span>
    <span
      className={cn(
        "font-mono text-sm text-right flex items-center justify-end tabular-nums",
        item.changeValue >= 0 ? "text-gain" : "text-loss"
      )}
    >
      {item.changeFormatted}
    </span>
    <span className="font-mono text-xs text-muted-foreground text-right flex items-center justify-end tabular-nums">
      {item.oiFormatted}
    </span>
  </div>
);

const MarketRowMobile = ({ item }: { item: FormattedPerp }) => (
  <div className="sm:hidden grid min-w-0 grid-cols-[1fr_80px_80px] gap-2 px-3 py-3">
    <div className="flex flex-col justify-center min-w-0">
      <span className="font-mono font-medium text-sm tabular-nums truncate">{item.coin}</span>
      <span className="text-[9px] text-muted-foreground capitalize">{item.category}</span>
    </div>
    <span className="font-mono text-sm text-right flex items-center justify-end text-foreground tabular-nums">
      ${formatPrice(item.markPx)}
    </span>
    <span
      className={cn(
        "font-mono text-sm text-right flex items-center justify-end tabular-nums",
        item.changeValue >= 0 ? "text-gain" : "text-loss"
      )}
    >
      {item.changeFormatted}
    </span>
  </div>
);

const MarketRowSkeletonDesktop = () => (
  <div className="hidden sm:grid min-w-0 grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-3">
    <Skeleton className="h-4 w-16" />
    <Skeleton className="h-4 w-14 ml-auto" />
    <Skeleton className="h-4 w-12 ml-auto" />
    <Skeleton className="h-4 w-14 ml-auto" />
  </div>
);

const MarketRowSkeletonMobile = () => (
  <div className="sm:hidden grid min-w-0 grid-cols-[1fr_80px_80px] gap-2 px-3 py-3">
    <Skeleton className="h-4 w-14" />
    <Skeleton className="h-4 w-12 ml-auto" />
    <Skeleton className="h-4 w-10 ml-auto" />
  </div>
);

function formatPrice(price: string): string {
  const num = Number(price);
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1)
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

export const PerpDropdown = memo(function PerpDropdown({ currentSymbol }: PerpDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "change">("name");
  const [sortDesc, setSortDesc] = useState(true);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, error } = usePerpList();

  const perps = data?.assets;

  const filteredPerps = useMemo(() => {
    if (!perps) return [];

    let filtered = perps;

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter((f) => f.coin.toLowerCase().includes(q));
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
  }, [perps, query, sortBy, sortDesc]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
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
    setOpen(true);
  }, []);

  const handleSelect = useCallback(
    (coin: string) => {
      navigate(`/perp/${coin.toLowerCase()}`);
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
    if (open && inputRef.current) {
      const timeout = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-perp-dropdown]")) {
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
  }, [open, handleClose]);

  const currentSymbolLower = useMemo(() => currentSymbol.toLowerCase(), [currentSymbol]);

  const formattedPerps = useMemo(() => {
    if (!filteredPerps) return [];
    return filteredPerps.map((item) => {
      const prevPx = Number(item.prevDayPx);
      const markPx = Number(item.markPx);
      const change = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;
      const oi = Number(item.openInterest);
      return {
        ...item,
        changeValue: change,
        changeFormatted: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
        oiFormatted:
          oi > 1000000
            ? `${(oi / 1000000).toFixed(1)}M`
            : oi > 1000
              ? `${(oi / 1000).toFixed(0)}K`
              : oi.toFixed(0),
        isActive: item.coin.toLowerCase() === currentSymbolLower,
      };
    });
  }, [filteredPerps, currentSymbolLower]);

  return (
    <div className="relative" data-perp-dropdown>
      <div ref={triggerRef} className="flex items-center gap-1 cursor-pointer" onClick={handleOpen}>
        <span className="font-mono font-semibold text-foreground tabular-nums font-mono-slashed">
          {currentSymbol}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <div
          className="fixed z-50 w-[calc(100vw-16px)] sm:w-[440px] bg-background border-border/30 rounded-xl shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-border/20">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground bg-transparent border-none p-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <MarketHeader sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} />
          <MarketHeaderMobile sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort} />

          <div className="max-h-[360px] sm:max-h-[400px] overflow-y-auto overscroll-none flex flex-col">
            {isLoading ? (
              <div className="divide-y divide-border/30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="divide-y divide-border/30">
                    <MarketRowSkeletonDesktop />
                    <MarketRowSkeletonMobile />
                  </div>
                ))}
              </div>
            ) : error ? (
              <ContentUnavailable
                variant="error"
                title="Failed to Load"
                description="Could not retrieve market data. Please try again."
              />
            ) : formattedPerps.length === 0 ? (
              <ContentUnavailable
                variant="no-data"
                title="No Markets Found"
                description="No markets match your current filters."
              />
            ) : (
              <div className="divide-y divide-border/30">
                {formattedPerps.map((item) => (
                  <button
                    key={item.coin}
                    type="button"
                    onClick={() => handleSelect(item.coin)}
                    className={cn(
                      "w-full text-left transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none cursor-pointer select-none tap-highlight",
                      item.isActive && "bg-muted/60"
                    )}
                  >
                    <MarketRowDesktop item={item} />
                    <MarketRowMobile item={item} />
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
