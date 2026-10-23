import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { calculatePxDecimals } from "@/features/trade/utils/trade-formatters";
import {
  formatSize,
  formatCompactUsd,
  formatSignedPercent,
  formatFundingPercent,
} from "@/core/utils/formatters";
import type { CategoryTab, FormattedTrade, TradeDropdownProps } from "../utils/trade-dropdown";
import { TradeDropdownTrigger } from "./trade-dropdown-trigger";
import { TradeDropdownPanel } from "./trade-dropdown-panel";

const TradeDropdownFn = ({
  currentSymbol,
  logoUrl,
  displaySymbol,
  currentDisplayName,
  onPrefetchMarkets,
}: TradeDropdownProps) => {
  const dropdownContentId = "trade-market-dropdown-content";
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [sortBy, setSortBy] = useState<"name" | "change">("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading, error } = useTradeList();

  useEffect(() => {
    if (!error) return;
    toast.error("Failed to load markets", {
      description: "Check your connection and try again.",
    });
  }, [error]);

  const displayLabel =
    currentDisplayName !== undefined && currentDisplayName !== ""
      ? currentDisplayName
      : displaySymbol !== undefined && displaySymbol !== ""
        ? displaySymbol
        : currentSymbol;
  const trades = data?.assets;

  const filteredTrades = useMemo(() => {
    if (!trades) return [];

    let filtered = trades;

    if (category !== "all") {
      if (category === "perps") {
        filtered = filtered.filter((f) => f.marketType === "perp");
      } else if (category === "spot") {
        filtered = filtered.filter((f) => f.marketType === "spot");
      } else if (category === "tradfi") {
        filtered = filtered.filter((f) =>
          ["stocks", "forex", "commodities", "indices"].includes(f.category),
        );
      } else if (category === "hip3") {
        filtered = filtered.filter((f) => f.isHip3);
      } else if (category === "trending") {
        filtered = filtered
          .toSorted((a, b) => Number(b.dayNtlVlm) - Number(a.dayNtlVlm))
          .slice(0, 10);
      } else {
        filtered = filtered.filter((f) => f.category === category);
      }
    }

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (f) => f.coin.toLowerCase().includes(q) || f.displaySymbol.toLowerCase().includes(q),
      );
    }

    filtered = filtered.toSorted((a, b) => {
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
        if (left + 700 > viewportWidth) {
          left = Math.max(8, viewportWidth - 710);
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
      void navigate(`/trade/${asset.rawCoin}`);
      handleClose();
    },
    [navigate, handleClose],
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
    [sortBy],
  );

  useEffect(() => {
    if (!isOpen) return () => {};
    const input = inputRef.current;
    if (input === null) return () => {};
    const timeout = setTimeout(() => {
      input.focus();
    }, 100);
    return () => {
      clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return () => {};

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-trade-dropdown]")) {
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

  const formattedTrades: FormattedTrade[] = useMemo(() => {
    const currentRawCoinLower = currentSymbol.toLowerCase();
    return filteredTrades.map((item) => {
      const prevPx = Number(item.prevDayPx);
      const markPx = Number(item.markPx);
      const change = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;
      const oi = Number(item.openInterest);
      const volume = Number(item.dayNtlVlm);
      const funding = Number(item.funding);
      const marketCap =
        item.marketType === "spot" ? markPx * Number(item.circulatingSupply ?? 0) : 0;
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
        funding: item.funding,
        isHip3: item.isHip3,
        category: item.category,
        dexPrefix: item.dexPrefix,
        changeValue: change,
        changeFormatted: formatSignedPercent(change),
        oiFormatted: formatSize(oi),
        volumeFormatted: formatCompactUsd(volume),
        fundingFormatted: formatFundingPercent(funding),
        marketCapFormatted: marketCap > 0 ? formatCompactUsd(marketCap) : "--",
        isActive: item.rawCoin.toLowerCase() === currentRawCoinLower,
        pxDecimals: pxDec,
      };
    });
  }, [filteredTrades, currentSymbol]);

  return (
    <div className="relative" data-trade-dropdown>
      <TradeDropdownTrigger
        triggerRef={triggerRef}
        isOpen={isOpen}
        onToggle={isOpen ? handleClose : handleOpen}
        onPrefetch={onPrefetchMarkets}
        displayLabel={displayLabel}
        displaySymbol={displaySymbol}
        logoUrl={logoUrl}
        contentId={dropdownContentId}
      />

      {isOpen && (
        <TradeDropdownPanel
          id={dropdownContentId}
          position={position}
          inputRef={inputRef}
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSort={handleSort}
          formattedTrades={formattedTrades}
          isLoading={isLoading}
          hasError={!!error}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export const TradeDropdown = TradeDropdownFn;
