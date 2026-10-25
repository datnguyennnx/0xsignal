import { useLayoutEffect, useRef, useState } from "react";
import { MAX_BOOK_DEPTH } from "@/core/utils/hyperliquid";
import { remToPx, subscribeRootFontSize } from "@/core/utils/rem";
import { DEFAULT_ROW_HEIGHT_REM, levelsPerHalf, VISIBLE_ROWS } from "../utils/orderbook-utils";

// Measure the real row height; fall back to the token when the row is absent.
function readRowHeightPx(body: HTMLElement): number {
  const row = body.querySelector<HTMLElement>("[data-orderbook-row]");
  const measured = row?.getBoundingClientRect().height ?? 0;
  return measured > 0 ? measured : remToPx(DEFAULT_ROW_HEIGHT_REM);
}

export function useOrderbookRows(): {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  rowsPerHalf: number;
  rowHeightPx: number;
} {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [rowsPerHalf, setRowsPerHalf] = useState<number>(Math.min(VISIBLE_ROWS, MAX_BOOK_DEPTH));
  const [rowHeightPx, setRowHeightPx] = useState<number>(() => remToPx(DEFAULT_ROW_HEIGHT_REM));

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return () => {};

    const apply = () => {
      const heightPx = element.getBoundingClientRect().height;
      const nextRowHeightPx = readRowHeightPx(element);
      // Fit as many rows as the container allows, never past the protocol cap.
      const next = Math.min(levelsPerHalf(heightPx, nextRowHeightPx), MAX_BOOK_DEPTH);
      setRowHeightPx((prev) => (prev === nextRowHeightPx ? prev : nextRowHeightPx));
      setRowsPerHalf((prev) => (prev === next ? prev : next));
    };

    apply();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        apply();
      });
      observer.observe(element);
    }
    const unsubscribe = subscribeRootFontSize(apply);

    return () => {
      observer?.disconnect();
      unsubscribe();
    };
  }, []);

  return { bodyRef, rowsPerHalf, rowHeightPx };
}
