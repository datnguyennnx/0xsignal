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

export function formatPerpTitle(symbol: string, price: number, pxDecimals: number): string {
  const formattedPrice = price.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: pxDecimals,
  });
  return `${symbol} $${formattedPrice}`;
}
