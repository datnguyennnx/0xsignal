import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "../utils/orderbook-table-classes";
import { PnLDisplay } from "./shared-table-components";

import { useNavigate } from "react-router-dom";
import { getNextFundingMs } from "@/features/asset-detail/utils/format";

const FUNDING_INTERVAL_MS = 3_600_000;

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

function computeAccruedFunding(
  settledFunding: number,
  positionValue: number,
  fundingRate: number | undefined,
  isLong: boolean
): number {
  if (!fundingRate || !Number.isFinite(fundingRate)) return settledFunding;
  const msToNext = getNextFundingMs();
  const elapsedMs = FUNDING_INTERVAL_MS - Math.min(msToNext, FUNDING_INTERVAL_MS);
  const elapsedFraction = elapsedMs / FUNDING_INTERVAL_MS;
  // Sign: positive funding rate → longs pay (−), shorts receive (+)
  const signAdj = isLong ? -1 : 1;
  const unsettled = positionValue * fundingRate * elapsedFraction * signAdj;
  return settledFunding + unsettled;
}

function TpSlCell({ tpSl }: { tpSl: { tp: string | null; sl: string | null } | undefined }) {
  if (!tpSl || (!tpSl.tp && !tpSl.sl)) {
    return <span className="text-muted-foreground/40">—</span>;
  }
  const parts: string[] = [];
  if (tpSl.tp) parts.push(`TP ${tpSl.tp}`);
  if (tpSl.sl) parts.push(`SL ${tpSl.sl}`);
  return <span className="text-xs font-medium text-foreground">{parts.join(" / ")}</span>;
}

interface PositionsTableProps {
  isChLoading: boolean;
  positions: Array<{
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
    };
  }>;
  fundingRates?: Record<string, number>;
  tpSlByCoin?: Record<string, { tp: string | null; sl: string | null }>;
  onCloseMarket?: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit?: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  /** Real-time mid prices from WebSocket, keyed by coin name */
  mids?: Record<string, number>;
}

export function PositionsTable({
  isChLoading,
  positions,
  onCloseMarket,
  onCloseLimit,
  mids,
  tpSlByCoin,
  fundingRates,
}: PositionsTableProps) {
  const navigate = useNavigate();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Position Value</TableHead>
          <TableHead className={cHeadNum}>Entry Price</TableHead>
          <TableHead className={cHeadNum}>Mark Price</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHeadNum}>Liq. Price</TableHead>
          <TableHead className={cHeadNum}>Margin</TableHead>
          <TableHead className={cHeadNum}>Funding</TableHead>
          <TableHead className={cHead}>Close All</TableHead>
          <TableHead className={cHead}>TP/SL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isChLoading ? (
          <TableRow>
            <TableCell colSpan={11} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
                Loading...
              </span>
            </TableCell>
          </TableRow>
        ) : positions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
                No open positions
              </span>
            </TableCell>
          </TableRow>
        ) : (
          positions.map(({ position }) => {
            const signedSz = Number(position.szi);
            const sz = Math.abs(signedSz);
            const entryPx = Number(position.entryPx);
            const posValue = Number(position.positionValue);
            const liqPx = Number(position.liquidationPx);
            const marginUsed = Number(position.marginUsed);
            const unrealizedPnl = Number(position.unrealizedPnl);
            const roe = Number(position.returnOnEquity) * 100;
            const settledFunding = Number(position.cumFunding.sinceOpen);
            const fundingRate = fundingRates?.[position.coin] ?? 0;
            const isLong = signedSz >= 0;
            const totalFunding = computeAccruedFunding(
              settledFunding,
              posValue,
              fundingRate,
              isLong
            );
            const computedMarkPx = signedSz !== 0 ? entryPx + unrealizedPnl / signedSz : entryPx;
            const markPx = mids?.[position.coin] ?? computedMarkPx;

            return (
              <TableRow key={position.coin}>
                <TableCell className={`${c} font-medium`}>
                  <button
                    type="button"
                    onClick={() => navigate(`/trade/${position.coin}`)}
                    className="relative overflow-hidden flex items-center w-full text-left cursor-pointer transition-colors hover:text-foreground rounded px-1 -mx-1"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded pointer-events-none"
                      style={{
                        background: `linear-gradient(to right, var(${
                          signedSz >= 0 ? "--gain-muted" : "--loss-muted"
                        }), transparent)`,
                      }}
                    />
                    <span className={`relative z-10 ${signedSz >= 0 ? "text-gain" : "text-loss"}`}>
                      {position.coin}
                    </span>
                  </button>
                </TableCell>
                <TableCell className={cNum}>
                  <span>{formatSize(sz)}</span>
                  <span className="text-muted-foreground ml-1">{position.coin}</span>
                </TableCell>
                <TableCell className={cNum}>{formatCompactUsd(posValue)}</TableCell>
                <TableCell className={cNum}>{formatPrice(entryPx)}</TableCell>
                <TableCell className={cNum}>{formatPrice(markPx)}</TableCell>
                <TableCell className={cNum}>
                  <PnLDisplay usd={unrealizedPnl} pct={roe} />
                </TableCell>
                <TableCell className={cNum}>{liqPx > 0 ? formatPrice(liqPx) : "—"}</TableCell>
                <TableCell className={cNum}>{formatCompactUsd(marginUsed)}</TableCell>
                <TableCell className={`${cNum} ${totalFunding >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatCompactUsd(totalFunding)}
                </TableCell>
                <TableCell className={c}>
                  <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                    <button
                      type="button"
                      onClick={() => onCloseMarket?.(position.coin, position.szi, signedSz >= 0)}
                      className="text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
                    >
                      Market
                    </button>
                    <span className="text-xs text-muted-foreground/40">/</span>
                    <button
                      type="button"
                      onClick={() =>
                        onCloseLimit?.({ coin: position.coin, sz, isLong: signedSz >= 0, markPx })
                      }
                      className="text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
                    >
                      Limit
                    </button>
                  </div>
                </TableCell>
                <TableCell className={c}>
                  <TpSlCell tpSl={tpSlByCoin?.[position.coin]} />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
