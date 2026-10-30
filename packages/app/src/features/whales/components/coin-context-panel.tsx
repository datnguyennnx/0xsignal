import { lazy, Suspense, useMemo, type JSX } from "react";
import type { WhalePosition } from "@0xsignal/shared";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import type { PanelComponentProps } from "@/components/side-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd, formatFundingPercent } from "@/core/utils/formatters";
import { useWhaleClearinghouseState } from "@/features/portfolio/hooks/use-portfolio-data";

import { useCoinAsset } from "../hooks/use-coin-asset";
import {
  rankOnSide,
  sharePercent,
  trackedInterestAnchor,
  useCoinMarket,
  type CoinMarket,
  type SideRank,
} from "../hooks/use-coin-market";
import { WhaleVolumeCard } from "./whale-volume-card";

// Kept dynamic: the panel is in the entry chunk, so neither recharts surface
// may be imported statically here.
const CoinPriceChart = lazy(() =>
  import("./coin-price-chart").then((chartModule) => ({ default: chartModule.CoinPriceChart })),
);
const LongShortDonut = lazy(() =>
  import("./long-short-donut").then((donutModule) => ({ default: donutModule.LongShortDonut })),
);

const SKELETON_ROWS = ["coin-context-1", "coin-context-2", "coin-context-3"] as const;
const GROUP_CLASS = "flex flex-col gap-2";
const GROUP_LABEL_CLASS = "text-xs font-normal text-muted-foreground";
const CAPTION_CLASS = "text-[11px] text-muted-foreground";
const WHALE_LIMIT = 10;

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

function GroupLabel({ children }: { children: string }): JSX.Element {
  return <h3 className={GROUP_LABEL_CLASS}>{children}</h3>;
}

interface WhaleAggregate {
  long: number;
  short: number;
  firstSide: "long" | "short";
}

interface WhaleRow {
  address: string;
  side: "long" | "short";
  notional: number;
}

/** One row per whale: its own split picks the side, a tie falling back to its first position. */
function toWhaleRows(rows: readonly WhalePosition[]): WhaleRow[] {
  const whales = new Map<string, WhaleAggregate>();

  for (const row of rows) {
    const side: "long" | "short" = row.side === "buy" ? "long" : "short";
    const key = row.userAddress.toLowerCase();
    const whale = whales.get(key);

    if (whale === undefined) {
      whales.set(key, {
        long: side === "long" ? row.notionalUsd : 0,
        short: side === "short" ? row.notionalUsd : 0,
        firstSide: side,
      });
      continue;
    }

    if (side === "long") whale.long += row.notionalUsd;
    else whale.short += row.notionalUsd;
  }

  return [...whales]
    .map(([address, whale]) => ({
      address,
      side:
        whale.long === whale.short ? whale.firstSide : whale.long > whale.short ? "long" : "short",
      notional: whale.long + whale.short,
    }))
    .toSorted((a, b) => b.notional - a.notional);
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
    <section className={GROUP_CLASS}>
      <GroupLabel>Market</GroupLabel>
      <dl className="flex flex-col gap-2">
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

interface WhaleCards {
  whales: readonly WhaleRow[];
  subjectAddress: string | undefined;
  subjectMeta:
    | {
        rank: number;
        total: number;
        side: "long" | "short";
        sharePercent: number;
      }
    | undefined;
}

/** The subject may rank outside the tracked page's top 25, so its card is appended last. */
function toWhaleCards(
  rows: readonly WhaleRow[],
  whaleAddress: string | null,
  ranked: SideRank | null,
  summary: CoinMarket,
): WhaleCards {
  const listed = rows.slice(0, WHALE_LIMIT);
  if (whaleAddress === null) {
    return { whales: listed, subjectAddress: undefined, subjectMeta: undefined };
  }

  const subjectAddress = whaleAddress.toLowerCase();
  const subject = rows.find((whale) => whale.address === subjectAddress);
  const subjectMeta: WhaleCards["subjectMeta"] =
    ranked === null
      ? undefined
      : {
          rank: ranked.rank,
          total: ranked.count,
          side: ranked.side === "buy" ? "long" : "short",
          sharePercent:
            sharePercent(
              ranked.notional,
              ranked.side === "buy" ? summary.long.notional : summary.short.notional,
            ) ?? 0,
        };

  return {
    whales: subject === undefined || listed.includes(subject) ? listed : [...listed, subject],
    subjectAddress,
    subjectMeta,
  };
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
  const whaleBreakdown = useMemo(() => toWhaleRows(rows), [rows]);
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
  const whaleCards = toWhaleCards(whaleBreakdown, whaleAddress, ranked, summary);
  const anchor = trackedInterestAnchor(
    summary.long.notional,
    summary.short.notional,
    openInterestUsd,
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CoinPriceChart
            coin={coin}
            markPx={markPx}
            rows={rows}
            summary={summary}
            subjectPosition={subjectPosition}
          />
        </Suspense>
      </header>
      <MarketStats asset={asset} openInterestUsd={openInterestUsd} />
      <section className={GROUP_CLASS}>
        <GroupLabel>Tracked split</GroupLabel>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <LongShortDonut long={summary.long} short={summary.short} />
        </Suspense>
        {anchor !== null && <p className={CAPTION_CLASS}>{anchor}</p>}
        {summary.truncated && (
          <p className={CAPTION_CLASS}>Showing the 200 largest tracked positions.</p>
        )}
      </section>
      {whaleCards.whales.length > 0 && (
        <section className={GROUP_CLASS}>
          <GroupLabel>Whales</GroupLabel>
          <WhaleVolumeCard
            whales={whaleCards.whales}
            subjectAddress={whaleCards.subjectAddress}
            subjectMeta={whaleCards.subjectMeta}
          />
        </section>
      )}
    </div>
  );
}
