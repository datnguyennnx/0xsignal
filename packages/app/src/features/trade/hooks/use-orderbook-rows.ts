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

    // The observed box is the only height input: the first entry lands before
    // paint, so the placeholder never paints the constant fallback.
    let lastHeightPx = 0;

    const apply = () => {
      if (lastHeightPx <= 0) return;
      // The body sits below the column header and holds the spread strip plus
      // both halves, so the only chrome to subtract is the spread at its floor.
      const minRowPx = remToPx(MIN_ROW_HEIGHT_REM);
      const maxRowPx = remToPx(MAX_ROW_HEIGHT_REM);
      const nextRows = rowsPerHalfFor(lastHeightPx, minRowPx);
      const nextRowHeightPx = clampRowHeight(lastHeightPx - minRowPx, nextRows, minRowPx, maxRowPx);
      setRowHeightPx((prev) => (prev === nextRowHeightPx ? prev : nextRowHeightPx));
      setRowsPerHalf((prev) => (prev === nextRows ? prev : nextRows));
    };

    const unobserve = observeResize(element, (entry) => {
      lastHeightPx = entry.contentRect.height;
      apply();
    });
    const unsubscribe = subscribeRootFontSize(apply);

    return () => {
      unobserve();
      unsubscribe();
    };
  }, []);

  return { bodyRef, rowsPerHalf, rowHeightPx };
}
