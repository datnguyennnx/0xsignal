import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useDeferredValue,
  startTransition,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { computeOverlayPosition } from "@/features/trade/lib/overlay-position";
import { buildMarketRows, selectMarketRows } from "@/features/trade/lib/market-row-data";
import { withViewTransition } from "@/lib/view-transition";
import { type CategoryTab, type TradeDropdownProps } from "../utils/trade-dropdown";
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
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<CategoryTab>("all");
  const [sortBy, setSortBy] = useState<"name" | "change">("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data, isLoading, error, dataUpdatedAt } = useTradeList(isOpen);

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

  // Built once per snapshot, never per keystroke: only the pipeline below touches it.
  const marketRows = useMemo(() => buildMarketRows(trades ?? []), [trades]);

  const rows = useMemo(() => {
    if (!isOpen) return [];
    return selectMarketRows(marketRows, category, deferredQuery, sortBy, sortDesc);
  }, [isOpen, marketRows, category, deferredQuery, sortBy, sortDesc]);

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

  const handleCategoryChange = useCallback((next: CategoryTab) => {
    startTransition(() => {
      setCategory(next);
    });
  }, []);

  const handleSort = useCallback(
    (field: "name" | "change") => {
      startTransition(() => {
        if (sortBy === field) {
          setSortDesc((prev) => !prev);
        } else {
          setSortBy(field);
          setSortDesc(true);
        }
      });
    },
    [sortBy],
  );

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
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={handleCategoryChange}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSort={handleSort}
          rows={rows}
          currentSymbol={currentSymbol}
          dataVersion={dataUpdatedAt}
          isLoading={isLoading}
          hasError={!!error}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export const TradeDropdown = TradeDropdownFn;
