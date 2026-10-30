import { useEffect } from "react";

import { formatPriceWithNSigFigs, RAW_PRICE_NSIG_FIGS } from "@/core/utils/formatters";

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

export function formatAssetTitle(symbol: string, price: number | null | undefined): string {
  // A non-positive price drives Math.log10 to -Infinity, so the sig-fig
  // formatter would ask for an unbounded decimal count.
  if (price == null || !Number.isFinite(price) || price <= 0) return symbol;
  return `${formatPriceWithNSigFigs(price, RAW_PRICE_NSIG_FIGS)} | ${symbol}`;
}
