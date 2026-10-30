import { lazy, Suspense, type JSX } from "react";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import type { PanelComponentProps } from "@/components/side-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd, formatFundingPercent, formatPrice } from "@/core/utils/formatters";
import { useWhaleClearinghouseState } from "@/features/portfolio/hooks/use-portfolio-data";

import { useCoinAsset } from "../hooks/use-coin-asset";
import {
  meaningfulSharePercent,
  parsePx,
  rankOnSide,
  sharePercent,
  sharePercentLabel,
  trackedInterestAnchor,
  useCoinMarket,
  type CoinMarket,
  type SideRank,
} from "../hooks/use-coin-market";

// Kept dynamic: the panel is in the entry chunk and the chart is the only
// recharts consumer on this path.
const CoinPriceChart = lazy(() =>
  import("./coin-price-chart").then((chartModule) => ({ default: chartModule.CoinPriceChart })),
);

const SKELETON_ROWS = ["coin-context-1", "coin-context-2", "coin-context-3"] as const;
const SECTION_LABEL_CLASS = "text-xs font-normal text-muted-foreground";
const CAPTION_CLASS = "text-[11px] text-muted-foreground";
const WHALE_BAR_MIN_WIDTH_PERCENT = 2;

interface MarketStatsSource {
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  const units = value % 10;
  if (units === 1) return `${value}st`;
  if (units === 2) return `${value}nd`;
  if (units === 3) return `${value}rd`;
  return `${value}th`;
}

function SectionLabel({ children }: { children: string }): JSX.Element {
  return <h3 className={SECTION_LABEL_CLASS}>{children}</h3>;
}

function SideRow({ label, side }: { label: string; side: CoinMarket["long"] }): JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="text-sm tabular-nums text-foreground">
        {formatCompactUsd(side.notional)}
      </span>
      <span>· {side.count}</span>
    </div>
  );
}

interface LongShortSplitProps {
  summary: CoinMarket;
  openInterestUsd: number | null;
}

function LongShortSplit({ summary, openInterestUsd }: LongShortSplitProps): JSX.Element {
  const total = summary.long.notional + summary.short.notional;
  const longPct = sharePercent(summary.long.notional, total);
  const shortPct = sharePercent(summary.short.notional, total);
  const biasPct = longPct === null ? null : longPct >= 50 ? longPct : 100 - longPct;
  const biasSide = longPct !== null && longPct >= 50 ? "long" : "short";
  const biasTone = biasPct === null ? "" : biasSide === "long" ? "text-gain" : "text-loss";
  const anchor = trackedInterestAnchor(
    summary.long.notional,
    summary.short.notional,
    openInterestUsd,
  );

  return (
    <section className="flex flex-col gap-2.5">
      <p className={`text-xl leading-none font-medium tabular-nums ${biasTone}`}>
        {biasPct === null ? "—" : `${biasPct.toFixed(1)}% ${biasSide}`}
      </p>
      {longPct !== null && (
        <>
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{sharePercentLabel(longPct)}</span>
            <span>{sharePercentLabel(shortPct)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-muted">
            <div className="flex h-full">
              <div className="bg-gain opacity-70" style={{ width: `${longPct}%` }} />
              <div className="bg-loss opacity-70" style={{ width: `${100 - longPct}%` }} />
            </div>
          </div>
        </>
      )}
      {anchor !== null && <p className={CAPTION_CLASS}>{anchor}</p>}
      <div className="flex flex-col gap-2">
        <SideRow label="Long" side={summary.long} />
        <SideRow label="Short" side={summary.short} />
      </div>
    </section>
  );
}

interface WhaleShareSubject {
  entryPx: string;
  positionValue: string;
}

interface WhaleShareProps {
  ranked: SideRank | null;
  subject: WhaleShareSubject | undefined;
  summary: CoinMarket;
  coin: string;
}

function whaleHeadline(ranked: SideRank): string {
  const sideWord = ranked.side === "buy" ? "longs" : "shorts";
  const place = ranked.rank === 1 ? "Largest" : `${ordinal(ranked.rank)} largest`;
  return `${place} of ${ranked.count} ${sideWord}`;
}

/** No rank means either no position at all or one outside the tracked page; only the subject settles which. */
function untrackedCopy(subject: WhaleShareSubject): string {
  const entry = parsePx(subject.entryPx);
  const notional = Number(subject.positionValue);
  const parts = ["Below the tracked threshold"];
  if (entry !== null) parts.push(`Entry ${formatPrice(entry)}`);
  if (Number.isFinite(notional) && notional > 0) parts.push(formatCompactUsd(notional));
  return parts.join(" · ");
}

function WhaleShare({ ranked, subject, summary, coin }: WhaleShareProps): JSX.Element {
  if (ranked === null) {
    return (
      <section className="flex flex-col gap-2">
        <SectionLabel>This whale</SectionLabel>
        <p className="text-sm text-muted-foreground">
          {subject === undefined ? `Not holding ${coin}` : untrackedCopy(subject)}
        </p>
      </section>
    );
  }

  const sideWord = ranked.side === "buy" ? "long" : "short";
  const sideTotal = ranked.side === "buy" ? summary.long.notional : summary.short.notional;
  const percent = meaningfulSharePercent(ranked.notional, sideTotal);
  const rawShare = sharePercent(ranked.notional, sideTotal) ?? 0;
  const barWidth = Math.min(100, Math.max(WHALE_BAR_MIN_WIDTH_PERCENT, rawShare));

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>This whale</SectionLabel>
      <p className="text-sm font-medium tabular-nums">{whaleHeadline(ranked)}</p>
      <div className="h-1 w-full overflow-hidden rounded-[2px] bg-muted">
        <div className="h-full rounded-[2px] bg-foreground/40" style={{ width: `${barWidth}%` }} />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {percent === null ? "<1%" : `${percent.toFixed(1)}%`} of tracked {sideWord} ·{" "}
        {formatCompactUsd(ranked.notional)}
      </p>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function MarketStats({
  asset,
  openInterestUsd,
}: {
  asset: MarketStatsSource | undefined;
  openInterestUsd: number | null;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Market</SectionLabel>
      <dl className="flex flex-col gap-2.5">
        <StatRow label="Funding" value={formatFundingPercent(toNumber(asset?.funding))} />
        <StatRow label="Open interest" value={formatCompactUsd(openInterestUsd)} />
        <StatRow label="24h volume" value={formatCompactUsd(toNumber(asset?.dayNtlVlm))} />
      </dl>
    </section>
  );
}

interface CrowdPlaceholderProps {
  coin: string;
  rowsEmpty: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/**
 * The crowd query owns the whole panel only while the subject has nothing to
 * draw: a whale outside the tracked page still has an entry and a liquidation,
 * so its absence from that page must not hide the chart.
 */
function crowdPlaceholder({
  coin,
  rowsEmpty,
  isLoading,
  isError,
  refetch,
}: CrowdPlaceholderProps): JSX.Element | null {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-3">
        {SKELETON_ROWS.map((key) => (
          <Skeleton key={key} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={`Unable to load ${coin} positions`}
        retryAction={() => {
          void refetch();
        }}
      />
    );
  }

  if (rowsEmpty) {
    return (
      <EmptyState
        variant="panel"
        title={`No ${coin} positions`}
        description="No tracked whale positions on this coin."
      />
    );
  }

  return null;
}

export function CoinContextPanel({ id }: PanelComponentProps): JSX.Element {
  // Verbatim: the route id is the query key and the lookup key, so `kPEPE` and
  // `xyz:GOLD` must not be case-folded or stripped on the way to the API.
  const coin = id.trim();
  const { address } = useParams<{ address: string }>();
  const whaleAddress = address === undefined || address === "" ? null : address;

  const { asset, markPx } = useCoinAsset(coin);
  const openInterestUnits = toNumber(asset?.openInterest);
  // Hyperliquid reports open interest in coin units; USD = units × mark.
  const openInterestUsd =
    openInterestUnits === null || markPx === null ? null : openInterestUnits * markPx;
  const { rows, summary, isLoading, isError, refetch } = useCoinMarket(coin, markPx);
  const { data: clearinghouse } = useWhaleClearinghouseState(whaleAddress ?? undefined);
  // The whale's own row, not the crowd page: a whale outside the largest 200
  // still has an entry and a liquidation, and the panel must draw both.
  const subjectPosition = clearinghouse?.assetPositions.find(
    ({ position }) => position.coin.toUpperCase() === coin.toUpperCase(),
  )?.position;

  if (coin === "") {
    return (
      <ErrorState
        title="Unable to load coin"
        description="This panel needs a coin symbol. Close it and pick a coin from the table."
      />
    );
  }

  if (subjectPosition === undefined) {
    const placeholder = crowdPlaceholder({
      coin,
      rowsEmpty: rows.length === 0,
      isLoading,
      isError,
      refetch,
    });
    if (placeholder !== null) return placeholder;
  }

  const ranked = whaleAddress === null ? null : rankOnSide(rows, whaleAddress);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl leading-none font-semibold">{coin.toUpperCase()}</h2>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CoinPriceChart
            coin={coin}
            markPx={markPx}
            rows={rows}
            summary={summary}
            subjectPosition={subjectPosition}
          />
        </Suspense>
      </div>
      <LongShortSplit summary={summary} openInterestUsd={openInterestUsd} />
      {whaleAddress !== null && (
        <WhaleShare ranked={ranked} subject={subjectPosition} summary={summary} coin={coin} />
      )}
      <MarketStats asset={asset} openInterestUsd={openInterestUsd} />
      {summary.truncated && (
        <p className={CAPTION_CLASS}>Showing the 200 largest tracked positions.</p>
      )}
    </div>
  );
}
