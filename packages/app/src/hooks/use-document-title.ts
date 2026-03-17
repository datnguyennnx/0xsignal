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

export function formatPerpTitle(symbol: string, price: number): string {
  const formattedPrice =
    price >= 1000
      ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : price.toFixed(2);

  return `${symbol} $${formattedPrice}`;
}
