import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { c, cNum, cHead, cHeadNum, TABLE_HEAD_CLASS } from "../utils/orderbook-table-classes";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import { useUserBalances, useWhaleBalances } from "../hooks/use-user-balances";
import { useAllMids } from "../hooks/use-all-mids";
import { PnLDisplay } from "./shared-table-components";

/**
 * Outcomes tab — displays current positions with their PnL and close actions.
 *
 * Data sourced from the clearinghouse state. A third party's account reads the
 * public clearinghouse endpoint, so no authenticated `user/*` call is ever made.
 * This mirrors a subset of the PositionsTable columns (excludes liq. price,
 * margin, funding, TP/SL) and provides a focused view of position outcomes.
 */
export function OutcomesTable({
  readOnlyAddress,
}: {
  readOnlyAddress?: string | undefined;
} = {}) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useUserBalances(!readOnly);
  const whale = useWhaleBalances(readOnlyAddress);
  const { isChLoading, positions } = readOnly ? whale : own;
  const mids = useAllMids();
  const showCloseAll = !readOnly;
  const columnCount = showCloseAll ? 7 : 6;

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
          {showCloseAll && <TableHead className={cHead}>Close All</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isChLoading ? (
          <TableRow>
            <TableCell colSpan={columnCount} className="text-center py-6">
              <span className={TABLE_HEAD_CLASS}>Loading...</span>
            </TableCell>
          </TableRow>
        ) : positions.length === 0 ? (
          <TableEmptyRow colSpan={columnCount} />
        ) : (
          positions.map(({ position }) => {
            const signedSz = Number(position.szi);
            const sz = Math.abs(signedSz);
            const entryPx = Number(position.entryPx);
            const posValue = Number(position.positionValue);
            const unrealizedPnl = Number(position.unrealizedPnl);
            const roe = Number(position.returnOnEquity) * 100;
            const computedMarkPx = signedSz === 0 ? entryPx : entryPx + unrealizedPnl / signedSz;
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
                {showCloseAll && (
                  <TableCell className={c}>
                    <span className="text-sm font-medium text-muted-foreground/60 uppercase tracking-wider">
                      —
                    </span>
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
