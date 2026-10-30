import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { computeOverlayPosition } from "@/features/trade/lib/overlay-position";
import { formatTradeRows } from "@/features/trade/lib/format-trade-rows";
import { withViewTransition } from "@/lib/view-transition";
import {
  filterTradeAssets,
  type CategoryTab,
  type FormattedTrade,
  type TradeDropdownProps,
} from "../utils/trade-dropdown";
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
  const { data, isLoading, error } = useTradeList(isOpen);

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
    if (!isOpen || !trades) return [];

    return filterTradeAssets(trades, category, query).toSorted((a, b) => {
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
  }, [isOpen, trades, category, query, sortBy, sortDesc]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const handleOpen = useCallback(() => {
    withViewTransition(() => {
      if (triggerRef.current) {
        setPosition(
          computeOverlayPosition(triggerRef.current.getBoundingClientRect(), {
            width: window.innerWidth,
            height: window.innerHeight,
          }),
        );
      }
      setIsOpen(true);
    });
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

  const formattedTrades = useMemo((): FormattedTrade[] => {
    if (!isOpen) return [];
    return formatTradeRows(filteredTrades, currentSymbol);
  }, [isOpen, filteredTrades, currentSymbol]);

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
