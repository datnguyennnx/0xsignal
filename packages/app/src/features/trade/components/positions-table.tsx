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
} from "./orderbook-table-classes";
import { PosDirLabel, PnLDisplay } from "./shared-table-components";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Styling constants ─── */

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/* ─── Types ─── */

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
  onCloseMarket?: (coin: string, size: string, isLong: boolean) => void;
  onCloseLimit?: (position: { coin: string; sz: number; isLong: boolean; markPx: number }) => void;
  onViewTpSl?: () => void;
  /** Real-time mid prices from WebSocket, keyed by coin name */
  mids?: Record<string, number>;
}

/* ─── Component ─── */

export function PositionsTable({
  isChLoading,
  positions,
  onCloseMarket,
  onCloseLimit,
  onViewTpSl,
  mids,
}: PositionsTableProps) {
  return (
    <div className="w-full overflow-x-auto">
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
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-24 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-14 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-10 rounded-sm" />
                </TableCell>
              </TableRow>
            ))
          ) : positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-6">
                <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
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
              const roe = Number(position.returnOnEquity);
              const cumFunding = Number(position.cumFunding.sinceOpen);
              const computedMarkPx = signedSz !== 0 ? entryPx + unrealizedPnl / signedSz : entryPx;
              const markPx = mids?.[position.coin] ?? computedMarkPx;

              return (
                <TableRow key={position.coin} className="border-b border-border/20">
                  <TableCell className={`${c} font-medium`}>
                    <span className="flex items-center gap-1.5">
                      {position.coin}
                      <PosDirLabel szi={position.szi} />
                    </span>
                  </TableCell>
                  <TableCell className={cNum}>{formatSize(sz)}</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(posValue)}</TableCell>
                  <TableCell className={cNum}>{formatPrice(entryPx)}</TableCell>
                  <TableCell className={cNum}>{formatPrice(markPx)}</TableCell>
                  <TableCell className={cNum}>
                    <PnLDisplay usd={unrealizedPnl} pct={roe} />
                  </TableCell>
                  <TableCell className={cNum}>{liqPx > 0 ? formatPrice(liqPx) : "—"}</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(marginUsed)}</TableCell>
                  <TableCell className={`${cNum} ${cumFunding >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCompactUsd(Math.abs(cumFunding))}
                  </TableCell>
                  <TableCell className={c}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onCloseMarket?.(position.coin, position.szi, signedSz >= 0)}
                        className="text-xs font-medium text-foreground hover:text-foreground/70 transition-colors"
                      >
                        Market
                      </button>
                      <span className="text-xs text-muted-foreground/40">/</span>
                      <button
                        onClick={() =>
                          onCloseLimit?.({ coin: position.coin, sz, isLong: signedSz >= 0, markPx })
                        }
                        className="text-xs font-medium text-foreground hover:text-foreground/70 transition-colors"
                      >
                        Limit
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className={c}>
                    <button
                      onClick={onViewTpSl}
                      className="text-xs font-medium text-foreground hover:text-foreground/70 transition-colors"
                    >
                      View
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
