import { memo, type ReactNode } from "react";
import { formatCompactUsd } from "@/core/utils/formatters";
import { MetricItem } from "./metric-item";
import {
  formatHeaderCompactUsd,
  formatHeaderFunding,
  formatHeaderPrice,
  formatHeaderSignedPercent,
  formatHeaderSignedUsd,
} from "./market-header-values";
import { contractAddressText } from "../utils/contract-address";

interface MarketTerminalHeaderProps {
  markPrice: number | null;
  oraclePrice: number | null;
  change24hAbs: number | null;
  change24hPct: number | null;
  volume24h: number | null;
  openInterest: number | null;
  fundingRate: number | null;
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
  const changeTone =
    change24hPct === null ? "neutral" : change24hPct >= 0 ? "positive" : "negative";
  const fundingTone = fundingRate === null ? "neutral" : fundingRate >= 0 ? "positive" : "negative";
  const isSpot = marketType === "spot";
  const contractText = contractAddressText(contractAddress);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <MetricItem label={isSpot ? "Price" : "Mark"} value={formatHeaderPrice(markPrice)} />
      {!isSpot && <MetricItem label="Oracle" value={formatHeaderPrice(oraclePrice)} />}
      <MetricItem
        label="24h Change"
        value={`${formatHeaderSignedUsd(change24hAbs)} / ${formatHeaderSignedPercent(change24hPct)}`}
        tone={changeTone}
      />
      <MetricItem label="24h Volume" value={formatHeaderCompactUsd(volume24h)} />
      {!isSpot && <MetricItem label="Open Interest" value={formatHeaderCompactUsd(openInterest)} />}
      {!isSpot && (
        <MetricItem
          label="Funding / Countdown"
          tone={fundingTone}
          value={
            <span className="flex items-baseline gap-1">
              <span className="tabular-nums">{formatHeaderFunding(fundingRate)}</span>
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
      {isSpot && contractText !== undefined && (
        <MetricItem
          label="Contract"
          value={
            <a
              href={`https://app.hyperliquid.xyz/explorer/token/${contractText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline truncate max-w-[clamp(9rem,12vw,16rem)]"
              title={contractText}
            >
              {contractText}
            </a>
          }
        />
      )}
    </div>
  );
});
