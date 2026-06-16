import { memo } from "react";
import { cn } from "@/core/utils/cn";
import { MetricItem } from "./metric-item";
import { formatSignedUsd, formatFundingPercent } from "../utils/format";
import { formatCompactUsd, formatPrice, formatSignedPercent } from "@/core/utils/formatters";

interface MarketTerminalHeaderProps {
  markPrice: number;
  oraclePrice: number;
  change24hAbs: number;
  change24hPct: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  fundingCountdown: string;
  marketType?: "perp" | "spot";
  marketCap?: number;
  contractAddress?: string;
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
    <div className="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
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
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] tracking-wider text-muted-foreground/60 font-medium uppercase leading-none mb-1">
            Funding / Countdown
          </span>
          <div className="flex items-baseline gap-1 text-sm leading-none">
            <span
              className={cn(
                "font-semibold tabular-nums",
                fundingTone === "positive" && "text-gain",
                fundingTone === "negative" && "text-loss"
              )}
            >
              {formatFundingPercent(fundingRate)}
            </span>
            <span className="text-muted-foreground/50 font-normal">/</span>
            <span className="text-muted-foreground/70 tabular-nums">{fundingCountdown}</span>
          </div>
        </div>
      )}
      {isSpot && marketCap !== undefined && (
        <MetricItem label="Market Cap" value={formatCompactUsd(marketCap)} />
      )}
      {isSpot && contractAddress && (
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] tracking-wider text-muted-foreground/60 font-medium uppercase leading-none mb-1">
            Contract
          </span>
          <a
            href={`https://app.hyperliquid.xyz/explorer/token/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold tabular-nums leading-none text-primary hover:underline truncate max-w-[12rem]"
          >
            {contractAddress}
          </a>
        </div>
      )}
    </div>
  );
});
