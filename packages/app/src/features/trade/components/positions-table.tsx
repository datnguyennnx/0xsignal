import { memo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import {
  PnLDisplay,
  PosDirLabel,
  TableEmptyRow,
  resolveTableState,
} from "./shared-table-components";
import { computeAccruedFunding, deriveMarkPrice } from "../utils/trade-math";
import { useMidPrice } from "@/stores/use-market-data-store";

import { useNavigate } from "react-router";

const CELL = cn(c, "px-2 py-1");
const CELL_NUM = cn(cNum, "px-2 py-1");
const CELL_HEAD = cn(cHead, "px-2 py-1");
const CELL_HEAD_NUM = cn(cHeadNum, "px-2 py-1");

function TpSlCell({ tpSl }: { tpSl: { tp: string | null; sl: string | null } | undefined }) {
  const hasTp = tpSl !== undefined && tpSl.tp !== null && tpSl.tp !== "";
  const hasSl = tpSl !== undefined && tpSl.sl !== null && tpSl.sl !== "";
  if (!hasTp && !hasSl) {
    return <span className="text-muted-foreground">—</span>;
  }
  const parts: string[] = [];
  if (tpSl.tp !== null && tpSl.tp !== "") parts.push(`TP ${tpSl.tp}`);
  if (tpSl.sl !== null && tpSl.sl !== "") parts.push(`SL ${tpSl.sl}`);
  return <span className="type-label font-medium text-foreground">{parts.join(" / ")}</span>;
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
  isChError?: boolean;
  positions: PositionRow[];
  fundingRates?: Record<string, number>;
  tpSlByCoin?: Record<string, { tp: string | null; sl: string | null }>;
  onCloseMarket?: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit?: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  /** Reloads the failed positions query. The error row omits the button when absent. */
  onRetry?: (() => void) | undefined;
  /** When set, a coin click is taken over here instead of navigating to the trade page. */
  onSelectCoin?: ((coin: string) => void) | undefined;
  /** A third party's account: render rows only, never an action affordance. */
  readOnly?: boolean;
}

interface PositionRowViewProps {
  position: PositionRow["position"];
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
  fundingRate,
  tpSl,
  readOnly,
  onCoinClick,
  onCloseMarket,
  onCloseLimit,
}: PositionRowViewProps) {
  // Row-scoped subscription: a tick for another coin leaves this row untouched.
  const liveMid = useMidPrice(readOnly ? "" : position.coin);
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
    : (liveMid ?? computedMarkPx);

  return (
    <TableRow>
      <TableCell className={`${CELL} font-medium`}>
        <Button
          type="button"
          variant="ghost"
          size="auto"
          onClick={() => {
            onCoinClick(position.coin);
          }}
          className="relative flex w-full items-center justify-start overflow-hidden -mx-1 text-left font-medium hover:bg-transparent active:scale-100"
        >
          <span className="relative z-10">{position.coin}</span>
        </Button>
      </TableCell>
      <TableCell className={CELL}>
        <PosDirLabel szi={position.szi} />
      </TableCell>
      <TableCell className={CELL_NUM}>
        <span>{formatSize(sz)}</span>
        <span className="text-muted-foreground ml-1">{position.coin}</span>
      </TableCell>
      <TableCell className={CELL_NUM}>{formatCompactUsd(posValue)}</TableCell>
      <TableCell className={CELL_NUM}>
        <PnLDisplay usd={unrealizedPnl} pct={roe} />
      </TableCell>
      <TableCell className={CELL_NUM}>{formatPrice(entryPx)}</TableCell>
      <TableCell className={CELL_NUM}>{markPx === null ? "—" : formatPrice(markPx)}</TableCell>
      <TableCell className={CELL_NUM}>{liqPx > 0 ? formatPrice(liqPx) : "—"}</TableCell>
      <TableCell className={CELL_NUM}>{formatCompactUsd(marginUsed)}</TableCell>
      <TableCell className={CELL_NUM}>
        {position.leverage?.type === "isolated"
          ? "Isolated"
          : position.leverage?.type === "cross"
            ? "Cross"
            : "—"}
      </TableCell>
      <TableCell className={`${CELL_NUM} ${totalFunding >= 0 ? "text-gain" : "text-loss"}`}>
        {formatCompactUsd(totalFunding)}
      </TableCell>
      {!readOnly && (
        <TableCell className={CELL}>
          <div className="flex items-center gap-inline">
            <Button
              type="button"
              variant="link"
              size="auto"
              onClick={() => onCloseMarket?.(position.coin, position.szi, signedSz >= 0)}
              className="text-foreground hover:text-foreground/80 hover:no-underline"
            >
              Market
            </Button>
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
              className="text-foreground hover:text-foreground/80 hover:no-underline"
            >
              Limit
            </Button>
          </div>
        </TableCell>
      )}
      {!readOnly && (
        <TableCell className={CELL}>
          <TpSlCell tpSl={tpSl} />
        </TableCell>
      )}
    </TableRow>
  );
}, areRowPropsEqual);

export function PositionsTable({
  isChLoading,
  isChError = false,
  positions,
  onCloseMarket,
  onCloseLimit,
  onRetry,
  onSelectCoin,
  tpSlByCoin,
  fundingRates,
  readOnly = false,
}: PositionsTableProps) {
  const navigate = useNavigate();
  const columnCount = readOnly ? 11 : 13;
  const state = resolveTableState({ isLoading: isChLoading, isError: isChError });
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
    <Table className="table-cull table-fixed">
      <colgroup>
        <col style={{ width: "8%" }} />
        <col style={{ width: "6%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "6%" }} />
        <col style={{ width: "8%" }} />
        {!readOnly && <col style={{ width: "6%" }} />}
        {!readOnly && <col style={{ width: "6%" }} />}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead className={CELL_HEAD}>Coin</TableHead>
          <TableHead className={CELL_HEAD}>Side</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Size</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Value</TableHead>
          <TableHead className={CELL_HEAD_NUM}>PNL (ROE %)</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Entry Price</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Mark Price</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Liq. Price</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Margin</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Mode</TableHead>
          <TableHead className={CELL_HEAD_NUM}>Funding</TableHead>
          {!readOnly && <TableHead className={CELL_HEAD}>Close All</TableHead>}
          {!readOnly && <TableHead className={CELL_HEAD}>TP/SL</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {state === "empty" ? (
          positions.length === 0 ? (
            <TableEmptyRow colSpan={columnCount} />
          ) : (
            positions.map(({ position }) => (
              <PositionRowView
                key={position.coin}
                position={position}
                fundingRate={fundingRates?.[position.coin] ?? 0}
                tpSl={tpSlByCoin?.[position.coin]}
                readOnly={readOnly}
                onCoinClick={handleCoinClick}
                onCloseMarket={onCloseMarket}
                onCloseLimit={onCloseLimit}
              />
            ))
          )
        ) : (
          <TableEmptyRow
            colSpan={columnCount}
            state={state}
            onRetry={onRetry}
            errorTitle="Couldn't load positions"
            errorDescription="The positions request failed. Check your connection and try again."
          />
        )}
      </TableBody>
    </Table>
  );
}
