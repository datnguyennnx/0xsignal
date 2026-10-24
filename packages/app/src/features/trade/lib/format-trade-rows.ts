import { calculatePxDecimals } from "@/features/trade/utils/trade-formatters";
import {
  formatSize,
  formatCompactUsd,
  formatSignedPercent,
  formatFundingPercent,
} from "@/core/utils/formatters";

// Narrow input port: the features must not depend on the shared market schema to render rows.
type TradeRowSource = {
  readonly coin: string;
  readonly rawCoin: string;
  readonly marketType: "perp" | "spot";
  readonly displaySymbol: string;
  readonly displayCategory: string;
  readonly dexPrefix: string | null;
  readonly isHip3: boolean;
  readonly category: string;
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly funding: string;
  readonly dayNtlVlm: string;
  readonly szDecimals: number;
  readonly circulatingSupply?: string | undefined;
};

export function formatTradeRows(rows: readonly TradeRowSource[], currentSymbol: string) {
  const currentRawCoinLower = currentSymbol.toLowerCase();
  return rows.map((item) => {
    const prevPx = Number(item.prevDayPx);
    const markPx = Number(item.markPx);
    const change = prevPx > 0 ? ((markPx - prevPx) / prevPx) * 100 : 0;
    const oi = Number(item.openInterest);
    const volume = Number(item.dayNtlVlm);
    const funding = Number(item.funding);
    const marketCap = item.marketType === "spot" ? markPx * Number(item.circulatingSupply ?? 0) : 0;
    const pxDec = calculatePxDecimals(item.szDecimals ?? 4);
    return {
      coin: item.coin,
      rawCoin: item.rawCoin,
      marketType: item.marketType,
      displaySymbol: item.displaySymbol,
      displayCategory: item.displayCategory,
      markPx: item.markPx,
      prevDayPx: item.prevDayPx,
      openInterest: item.openInterest,
      dayNtlVlm: item.dayNtlVlm,
      funding: item.funding,
      isHip3: item.isHip3,
      category: item.category,
      dexPrefix: item.dexPrefix,
      changeValue: change,
      changeFormatted: formatSignedPercent(change),
      oiFormatted: formatSize(oi),
      volumeFormatted: formatCompactUsd(volume),
      fundingFormatted: formatFundingPercent(funding),
      marketCapFormatted: marketCap > 0 ? formatCompactUsd(marketCap) : "--",
      isActive: item.rawCoin.toLowerCase() === currentRawCoinLower,
      pxDecimals: pxDec,
    };
  });
}
