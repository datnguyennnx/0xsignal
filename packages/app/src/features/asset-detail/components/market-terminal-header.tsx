import { memo, type ReactNode } from "react";
import { formatCompactUsd, formatPrice, formatSignedPercent } from "@/core/utils/formatters";
import { MetricItem } from "./metric-item";
import { formatSignedUsd, formatFundingPercent } from "../utils/format";

interface MarketTerminalHeaderProps {
  markPrice: number;
  oraclePrice: number;
  change24hAbs: number;
  change24hPct: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  fundingCountdown: ReactNode;
  marketType?: "perp" | "spot" | undefined;
  marketCap?: number | undefined;
  contractAddress?: string | undefined;
}

export const MarketTerminalHeader = memo(function MarketTerminalHeader({
  markPrice,
  oraclePrice,
  change24hAbs,
  change24hPct,
  volume24h,
  openInterest,
  fundingRate,
  fundingCountdown,
  marketType,
  marketCap,
  contractAddress,
}: MarketTerminalHeaderProps) {
  const changeTone = change24hPct >= 0 ? "positive" : "negative";
  const fundingTone = fundingRate >= 0 ? "positive" : "negative";
  const isSpot = marketType === "spot";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <MetricItem label={isSpot ? "Price" : "Mark"} value={formatPrice(markPrice)} />
      {!isSpot && <MetricItem label="Oracle" value={formatPrice(oraclePrice)} />}
      <MetricItem
        label="24h Change"
        value={`${formatSignedUsd(change24hAbs)} / ${formatSignedPercent(change24hPct)}`}
        tone={changeTone}
      />
      <MetricItem label="24h Volume" value={formatCompactUsd(volume24h)} />
      {!isSpot && <MetricItem label="Open Interest" value={formatCompactUsd(openInterest)} />}
      {!isSpot && (
        <MetricItem
          label="Funding / Countdown"
          tone={fundingTone}
          value={
            <span className="flex items-baseline gap-1">
              <span className="tabular-nums">{formatFundingPercent(fundingRate)}</span>
              <span className="text-muted-foreground tabular-nums font-normal">
                {fundingCountdown}
              </span>
            </span>
          }
        />
      )}
      {isSpot && marketCap !== undefined && (
        <MetricItem label="Market Cap" value={formatCompactUsd(marketCap)} />
      )}
      {isSpot && contractAddress !== undefined && contractAddress !== "" && (
        <MetricItem
          label="Contract"
          value={
            <a
              href={`https://app.hyperliquid.xyz/explorer/token/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline truncate max-w-[clamp(9rem,12vw,16rem)]"
            >
              {contractAddress}
            </a>
          }
        />
      )}
    </div>
  );
});
