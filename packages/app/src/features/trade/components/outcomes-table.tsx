import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import { useUserBalances } from "../hooks/use-user-balances";
import { useAllMids } from "../hooks/use-all-mids";
import { PnLDisplay } from "./shared-table-components";

/**
 * Outcomes tab — displays current positions with their PnL and close actions.
 *
 * Data sourced from the clearinghouse state via useUserBalances.
 * This mirrors a subset of the PositionsTable columns (excludes liq. price,
 * margin, funding, TP/SL) and provides a focused view of position outcomes.
 */
export function OutcomesTable() {
  const { isChLoading, positions } = useUserBalances();
  const mids = useAllMids();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Outcome</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Position Value</TableHead>
          <TableHead className={cHeadNum}>Entry Price</TableHead>
          <TableHead className={cHeadNum}>Mark Price</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHead}>Close All</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isChLoading ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
                Loading...
              </span>
            </TableCell>
          </TableRow>
        ) : positions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-6">
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
            const unrealizedPnl = Number(position.unrealizedPnl);
            const roe = Number(position.returnOnEquity) * 100;
            const computedMarkPx = signedSz !== 0 ? entryPx + unrealizedPnl / signedSz : entryPx;
            const markPx = mids?.[position.coin] ?? computedMarkPx;
            const isLong = signedSz >= 0;

            return (
              <TableRow key={position.coin}>
                <TableCell className={`${c} font-medium ${isLong ? "text-gain" : "text-loss"}`}>
                  {position.coin}
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
                <TableCell className={c}>
                  <span className="text-sm font-medium text-muted-foreground/40 uppercase tracking-wider">
                    —
                  </span>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
