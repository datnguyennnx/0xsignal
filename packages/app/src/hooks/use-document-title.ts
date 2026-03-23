/**
 * @overview Document Title Hook
 *
 * Manages the browser tab title dynamically based on the current page context.
 * Useful for real-time price updates in the tab title for better UX.
 */
import { useEffect } from "react";

interface UseDocumentTitleOptions {
  title: string;
  suffix?: string;
  separator?: string;
}

export function useDocumentTitle({
  title,
  suffix = "0xsignal",
  separator = " | ",
}: UseDocumentTitleOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title}${separator}${suffix}` : suffix;
    document.title = fullTitle;
  }, [title, suffix, separator]);
}

export function formatPerpTitle(symbol: string, price: number, pxDecimals?: number): string {
  const decimals = pxDecimals ?? 5;
  const formattedPrice = price.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return `${symbol} $${formattedPrice}`;
}
