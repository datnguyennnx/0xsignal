import { useLayoutEffect, useRef, useState } from "react";
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
  const [rowsPerHalf, setRowsPerHalf] = useState<number>(VISIBLE_ROWS);
  const [rowHeightPx, setRowHeightPx] = useState<number>(() => remToPx(DEFAULT_ROW_HEIGHT_REM));

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return () => {};

    const apply = () => {
      const heightPx = element.getBoundingClientRect().height;
      const nextRowHeightPx = readRowHeightPx(element);
      const next = levelsPerHalf(heightPx, nextRowHeightPx);
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
