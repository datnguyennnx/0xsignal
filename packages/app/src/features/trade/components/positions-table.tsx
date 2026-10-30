import { memo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import { PnLDisplay, PosDirLabel } from "./shared-table-components";
import { computeAccruedFunding, deriveMarkPrice } from "../utils/trade-math";

import { useNavigate } from "react-router-dom";

const SKELETON_ROW_COUNT = 3;

/** Same 1.5em line box as a loaded `c` cell, so a placeholder row is exactly one row tall. */
function TableSkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          <TableCell colSpan={columns} className={c}>
            <div className="flex items-center gap-4">
              {Array.from({ length: columns }, (_column, columnIndex) => (
                <Skeleton key={columnIndex} className="h-[1.5em] flex-1" />
              ))}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function TpSlCell({ tpSl }: { tpSl: { tp: string | null; sl: string | null } | undefined }) {
  const hasTp = tpSl !== undefined && tpSl.tp !== null && tpSl.tp !== "";
  const hasSl = tpSl !== undefined && tpSl.sl !== null && tpSl.sl !== "";
  if (!hasTp && !hasSl) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  const parts: string[] = [];
  if (tpSl.tp !== null && tpSl.tp !== "") parts.push(`TP ${tpSl.tp}`);
  if (tpSl.sl !== null && tpSl.sl !== "") parts.push(`SL ${tpSl.sl}`);
  return <span className="text-xs font-medium text-foreground">{parts.join(" / ")}</span>;
}

export type PositionRow = {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    positionValue: string;
    liquidationPx: string | null;
    marginUsed: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    cumFunding: { sinceOpen: string };
    leverage?: { type: "cross" | "isolated"; value?: number };
  };
};

interface PositionsTableProps {
  isChLoading: boolean;
  positions: PositionRow[];
  fundingRates?: Record<string, number>;
  tpSlByCoin?: Record<string, { tp: string | null; sl: string | null }>;
  onCloseMarket?: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit?: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  /** When set, a coin click is taken over here instead of navigating to the trade page. */
  onSelectCoin?: ((coin: string) => void) | undefined;
  mids?: Record<string, number> | undefined;
  /** A third party's account: render rows only, never an action affordance. */
  readOnly?: boolean;
}

interface PositionRowViewProps {
  position: PositionRow["position"];
  /** The row's own mark input; the displayed mark is derived from it below. */
  mid: number | undefined;
  fundingRate: number;
  tpSl: { tp: string | null; sl: string | null } | undefined;
  readOnly: boolean;
  onCoinClick: (coin: string) => void;
  onCloseMarket: ((coin: string, size: string, isLong: boolean) => void) | undefined;
  onCloseLimit:
    | ((position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void)
    | undefined;
}

/**
 * Compares the scalars a row prints (plus the callbacks it closes over) so a tick
 * that leaves this row's inputs untouched never reaches its render.
 */
function areRowPropsEqual(prev: PositionRowViewProps, next: PositionRowViewProps): boolean {
  const a = prev.position;
  const b = next.position;
  return (
    a.coin === b.coin &&
    a.szi === b.szi &&
    a.entryPx === b.entryPx &&
    a.positionValue === b.positionValue &&
    a.unrealizedPnl === b.unrealizedPnl &&
    a.returnOnEquity === b.returnOnEquity &&
    a.liquidationPx === b.liquidationPx &&
    a.marginUsed === b.marginUsed &&
    a.cumFunding.sinceOpen === b.cumFunding.sinceOpen &&
    a.leverage?.type === b.leverage?.type &&
    a.leverage?.value === b.leverage?.value &&
    prev.mid === next.mid &&
    prev.fundingRate === next.fundingRate &&
    prev.readOnly === next.readOnly &&
    prev.tpSl?.tp === next.tpSl?.tp &&
    prev.tpSl?.sl === next.tpSl?.sl &&
    prev.onCoinClick === next.onCoinClick &&
    prev.onCloseMarket === next.onCloseMarket &&
    prev.onCloseLimit === next.onCloseLimit
  );
}

const PositionRowView = memo(function PositionRowView({
  position,
  mid,
  fundingRate,
  tpSl,
  readOnly,
  onCoinClick,
  onCloseMarket,
  onCloseLimit,
}: PositionRowViewProps) {
  const signedSz = Number(position.szi);
  const sz = Math.abs(signedSz);
  const entryPx = Number(position.entryPx);
  const posValue = Number(position.positionValue);
  const liqPx = Number(position.liquidationPx);
  const marginUsed = Number(position.marginUsed);
  const unrealizedPnl = Number(position.unrealizedPnl);
  const roe = Number(position.returnOnEquity) * 100;
  const settledFunding = Number(position.cumFunding.sinceOpen);
  const isLong = signedSz >= 0;
  const totalFunding = computeAccruedFunding(settledFunding, posValue, fundingRate, isLong);
  const computedMarkPx = signedSz === 0 ? entryPx : entryPx + unrealizedPnl / signedSz;
  const markPx = readOnly
    ? deriveMarkPrice(position.positionValue, signedSz)
    : (mid ?? computedMarkPx);

  return (
    <TableRow>
      <TableCell className={`${c} font-medium`}>
        <button
          type="button"
          onClick={() => {
            onCoinClick(position.coin);
          }}
          className="relative overflow-hidden flex items-center w-full text-left cursor-pointer transition-colors hover:text-foreground rounded px-1 -mx-1"
        >
          <span className="relative z-10">{position.coin}</span>
        </button>
      </TableCell>
      <TableCell className={c}>
        <PosDirLabel szi={position.szi} />
      </TableCell>
      <TableCell className={cNum}>
        <span>{formatSize(sz)}</span>
        <span className="text-muted-foreground ml-1">{position.coin}</span>
      </TableCell>
      <TableCell className={cNum}>{formatCompactUsd(posValue)}</TableCell>
      <TableCell className={cNum}>
        <PnLDisplay usd={unrealizedPnl} pct={roe} />
      </TableCell>
      <TableCell className={cNum}>{formatPrice(entryPx)}</TableCell>
      <TableCell className={cNum}>{markPx === null ? "—" : formatPrice(markPx)}</TableCell>
      <TableCell className={cNum}>{liqPx > 0 ? formatPrice(liqPx) : "—"}</TableCell>
      <TableCell className={cNum}>{formatCompactUsd(marginUsed)}</TableCell>
      <TableCell className={cNum}>
        {position.leverage?.type === "isolated"
          ? "Isolated"
          : position.leverage?.type === "cross"
            ? "Cross"
            : "—"}
      </TableCell>
      <TableCell className={`${cNum} ${totalFunding >= 0 ? "text-gain" : "text-loss"}`}>
        {formatCompactUsd(totalFunding)}
      </TableCell>
      {!readOnly && (
        <TableCell className={c}>
          <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            <Button
              type="button"
              variant="link"
              size="auto"
              onClick={() => onCloseMarket?.(position.coin, position.szi, signedSz >= 0)}
              className="text-sm text-foreground hover:text-foreground/80 hover:no-underline"
            >
              Market
            </Button>
            <span className="text-xs text-muted-foreground/60">/</span>
            <Button
              type="button"
              variant="link"
              size="auto"
              onClick={() =>
                onCloseLimit?.({
                  coin: position.coin,
                  sz,
                  isLong: signedSz >= 0,
                  markPx: markPx ?? computedMarkPx,
                })
              }
              className="text-sm text-foreground hover:text-foreground/80 hover:no-underline"
            >
              Limit
            </Button>
          </div>
        </TableCell>
      )}
      {!readOnly && (
        <TableCell className={c}>
          <TpSlCell tpSl={tpSl} />
        </TableCell>
      )}
    </TableRow>
  );
}, areRowPropsEqual);

export function PositionsTable({
  isChLoading,
  positions,
  onCloseMarket,
  onCloseLimit,
  onSelectCoin,
  mids,
  tpSlByCoin,
  fundingRates,
  readOnly = false,
}: PositionsTableProps) {
  const navigate = useNavigate();
  const columnCount = readOnly ? 11 : 13;
  const handleCoinClick = useCallback(
    (coin: string) => {
      if (onSelectCoin !== undefined) {
        onSelectCoin(coin);
        return;
      }
      void navigate(`/trade/${coin}`);
    },
    [navigate, onSelectCoin],
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHead}>Side</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Position Value</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHeadNum}>Entry Price</TableHead>
          <TableHead className={cHeadNum}>Mark Price</TableHead>
          <TableHead className={cHeadNum}>Liq. Price</TableHead>
          <TableHead className={cHeadNum}>Margin</TableHead>
          <TableHead className={cHeadNum}>Mode</TableHead>
          <TableHead className={cHeadNum}>Funding</TableHead>
          {!readOnly && <TableHead className={cHead}>Close All</TableHead>}
          {!readOnly && <TableHead className={cHead}>TP/SL</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isChLoading ? (
          <TableSkeletonRows columns={columnCount} />
        ) : positions.length === 0 ? (
          <TableEmptyRow colSpan={columnCount} />
        ) : (
          positions.map(({ position }) => (
            <PositionRowView
              key={position.coin}
              position={position}
              mid={mids?.[position.coin]}
              fundingRate={fundingRates?.[position.coin] ?? 0}
              tpSl={tpSlByCoin?.[position.coin]}
              readOnly={readOnly}
              onCoinClick={handleCoinClick}
              onCloseMarket={onCloseMarket}
              onCloseLimit={onCloseLimit}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}
