import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils/cn";
import { usePerpList } from "@/hooks/use-perp-list";
import { Skeleton } from "@/components/ui/skeleton";

interface PerpDropdownProps {
  currentSymbol: string;
}

export const PerpDropdown = memo(function PerpDropdown({ currentSymbol }: PerpDropdownProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortByChange, setSortByChange] = useState(false);
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

    if (sortByChange) {
      filtered = [...filtered].sort((a, b) => {
        const changeA = a.prevDayPx
          ? (Number(a.markPx) - Number(a.prevDayPx)) / Number(a.prevDayPx)
          : 0;
        const changeB = b.prevDayPx
          ? (Number(b.markPx) - Number(b.prevDayPx)) / Number(b.prevDayPx)
          : 0;
        return sortDesc ? changeB - changeA : changeA - changeB;
      });
    }

    return filtered;
  }, [perps, query, sortByChange, sortDesc]);

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

  const formatPrice = useCallback((price: string) => {
    const num = Number(price);
    if (num >= 1000) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (num >= 1) {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  }, []);

  const formatChange = useCallback((markPx: string, prevDayPx: string) => {
    if (!prevDayPx) return { value: 0, formatted: "0.00%" };
    const change = ((Number(markPx) - Number(prevDayPx)) / Number(prevDayPx)) * 100;
    return {
      value: change,
      formatted: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
    };
  }, []);

  const formatOi = useCallback((oi: string) => {
    const num = Number(oi);
    if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  }, []);

  const currentSymbolLower = useMemo(() => currentSymbol.toLowerCase(), [currentSymbol]);

  return (
    <div className="relative" data-perp-dropdown>
      <div ref={triggerRef} className="flex items-center gap-1 cursor-pointer" onClick={handleOpen}>
        <span className="font-mono font-semibold text-foreground">{currentSymbol}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <div
          className="fixed z-50 w-[calc(100vw-16px)] sm:w-[440px] bg-background border border-border rounded-lg shadow-2xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search perp..."
                className="pl-9 pr-8 bg-muted/30 border-border h-10 text-sm rounded-md focus:ring-1 focus:ring-offset-0"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="hidden sm:grid grid-cols-4 gap-2 px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
            <span>Market</span>
            <span className="text-right">Price</span>
            <button
              onClick={() => {
                if (sortByChange) {
                  setSortDesc((prev) => !prev);
                } else {
                  setSortByChange(true);
                  setSortDesc(true);
                }
              }}
              className="text-right hover:text-foreground transition-colors flex items-center justify-end gap-1"
            >
              24h
              {sortByChange ? (
                sortDesc ? (
                  <ArrowDown className="w-3 h-3 text-gain" />
                ) : (
                  <ArrowUp className="w-3 h-3 text-loss" />
                )
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>
            <span className="text-right">OI</span>
          </div>
          <div className="sm:hidden grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
            <span>Market</span>
            <span className="text-right">Price</span>
            <button
              onClick={() => {
                if (sortByChange) {
                  setSortDesc((prev) => !prev);
                } else {
                  setSortByChange(true);
                  setSortDesc(true);
                }
              }}
              className="text-right hover:text-foreground transition-colors flex items-center justify-end gap-1"
            >
              24h
              {sortByChange ? (
                sortDesc ? (
                  <ArrowDown className="w-3 h-3 text-gain" />
                ) : (
                  <ArrowUp className="w-3 h-3 text-loss" />
                )
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              )}
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[360px] sm:max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="divide-y divide-border/30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="hidden sm:grid grid-cols-4 gap-2 px-4 py-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14 ml-auto" />
                    <Skeleton className="h-4 w-12 ml-auto" />
                    <Skeleton className="h-4 w-14 ml-auto" />
                  </div>
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`mobile-${i}`} className="sm:hidden grid grid-cols-3 gap-2 px-3 py-3">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-12 ml-auto" />
                    <Skeleton className="h-4 w-10 ml-auto" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-loss text-sm">Failed to load markets</div>
            ) : filteredPerps.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No markets found</div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredPerps.map((item) => {
                  const { value: change, formatted: changeFormatted } = formatChange(
                    item.markPx,
                    item.prevDayPx
                  );
                  const isActive = item.coin.toLowerCase() === currentSymbolLower;
                  const oiFormatted = formatOi(item.openInterest);

                  return (
                    <button
                      key={item.coin}
                      onClick={() => handleSelect(item.coin)}
                      className={cn(
                        "w-full text-left transition-colors hover:bg-muted/40",
                        isActive && "bg-muted/60"
                      )}
                    >
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-4 gap-2 px-4 py-3">
                        <div className="flex flex-col justify-center">
                          <span className="font-mono font-medium text-sm">{item.coin}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {item.category}
                          </span>
                        </div>
                        <span className="font-mono text-sm text-right flex items-center justify-end text-foreground">
                          ${formatPrice(item.markPx)}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-sm text-right flex items-center justify-end",
                            change >= 0 ? "text-green-500" : "text-red-500"
                          )}
                        >
                          {changeFormatted}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground text-right flex items-center justify-end">
                          {oiFormatted}
                        </span>
                      </div>
                      {/* Mobile row */}
                      <div className="sm:hidden grid grid-cols-3 gap-2 px-3 py-3">
                        <div className="flex flex-col justify-center min-w-0">
                          <span className="font-mono font-medium text-sm truncate">
                            {item.coin}
                          </span>
                          <span className="text-[9px] text-muted-foreground capitalize">
                            {item.category}
                          </span>
                        </div>
                        <span className="font-mono text-sm text-right flex items-center justify-end text-foreground">
                          ${formatPrice(item.markPx)}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-sm text-right flex items-center justify-end",
                            change >= 0 ? "text-green-500" : "text-red-500"
                          )}
                        >
                          {changeFormatted}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
