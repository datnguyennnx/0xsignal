import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";
import { computeWindow, type MarketWindow } from "../lib/market-window";
import { defaultRowHeightPx } from "../lib/overlay-position";
import { type VisibleCoinRows, visibleCoinsOf } from "../lib/visible-coins";

export const VISIBLE_COIN_OVERSCAN = 8;

interface ScrollOffsetEvent {
  readonly currentTarget: { readonly scrollTop: number };
}

interface VisibleCoinWindow {
  readonly range: MarketWindow;
  readonly visibleCoins: readonly string[];
}

interface VisibleCoinWindowInput {
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight: number;
}

export function scrollOffsetOf(event: ScrollOffsetEvent): number {
  return event.currentTarget.scrollTop;
}

export function computeVisibleCoinWindow(
  rows: VisibleCoinRows,
  input: VisibleCoinWindowInput,
): VisibleCoinWindow {
  const range = computeWindow({
    scrollTop: input.scrollTop,
    viewportHeight: input.viewportHeight,
    rowHeight: input.rowHeight,
    total: rows.length,
    overscan: VISIBLE_COIN_OVERSCAN,
  });
  return { range, visibleCoins: visibleCoinsOf(rows, range) };
}

interface VisibleCoinWindowResult extends VisibleCoinWindow {
  readonly scrollTop: number;
  readonly onScroll: (event: UIEvent<HTMLDivElement>) => void;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly firstRowRef: RefObject<HTMLButtonElement | null>;
  readonly rowHeight: number;
  readonly resetScroll: () => void;
}

export function useVisibleCoinWindow(rows: VisibleCoinRows): VisibleCoinWindowResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState(defaultRowHeightPx);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(scrollOffsetOf(event));
  }, []);

  const resetScroll = useCallback(() => {
    setScrollTop(0);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || rows.length === 0) return () => {};

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === element) {
          setViewportHeight(element.clientHeight);
          continue;
        }
        if (!(entry.target instanceof HTMLElement)) continue;
        const measured = entry.target.offsetHeight;
        if (measured > 0) setRowHeight(measured);
      }
    });

    observer.observe(element);
    if (firstRowRef.current) observer.observe(firstRowRef.current);
    return () => {
      observer.disconnect();
    };
  }, [rows]);

  const { range, visibleCoins } = useMemo(
    () => computeVisibleCoinWindow(rows, { scrollTop, viewportHeight, rowHeight }),
    [rows, scrollTop, viewportHeight, rowHeight],
  );

  return {
    scrollTop,
    onScroll,
    scrollRef,
    firstRowRef,
    rowHeight,
    resetScroll,
    visibleCoins,
    range,
  };
}
