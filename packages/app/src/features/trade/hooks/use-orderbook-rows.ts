import { useLayoutEffect, useRef, useState } from "react";
import { remToPx, subscribeRootFontSize } from "@/core/utils/rem";
import { observeResize } from "@/lib/resize-observer";
import {
  clampRowHeight,
  MAX_ROW_HEIGHT_REM,
  MIN_ROW_HEIGHT_REM,
  rowsPerHalfFor,
  VISIBLE_ROWS,
} from "../utils/orderbook-utils";

export function useOrderbookRows(): {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  rowsPerHalf: number;
  rowHeightPx: number;
} {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [rowsPerHalf, setRowsPerHalf] = useState<number>(() => VISIBLE_ROWS);
  const [rowHeightPx, setRowHeightPx] = useState<number>(() => remToPx(MIN_ROW_HEIGHT_REM));

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return () => {};

    const apply = () => {
      // The measured body sits below the column header and holds the spread strip
      // plus both halves, so the only chrome to subtract is the spread at its floor.
      const heightPx = element.getBoundingClientRect().height;
      const minRowPx = remToPx(MIN_ROW_HEIGHT_REM);
      const maxRowPx = remToPx(MAX_ROW_HEIGHT_REM);
      const nextRows = rowsPerHalfFor(heightPx, minRowPx);
      const nextRowHeightPx = clampRowHeight(heightPx - minRowPx, nextRows, minRowPx, maxRowPx);
      setRowHeightPx((prev) => (prev === nextRowHeightPx ? prev : nextRowHeightPx));
      setRowsPerHalf((prev) => (prev === nextRows ? prev : nextRows));
    };

    apply();

    let unobserve: (() => void) | null = null;
    if (typeof ResizeObserver !== "undefined") {
      unobserve = observeResize(element, () => {
        apply();
      });
    }
    const unsubscribe = subscribeRootFontSize(apply);

    return () => {
      unobserve?.();
      unsubscribe();
    };
  }, []);

  return { bodyRef, rowsPerHalf, rowHeightPx };
}
