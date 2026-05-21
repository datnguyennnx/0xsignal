import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCompactUsd } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "./orderbook-table-classes";
import { PnLDisplay } from "./shared-table-components";

/* ─── Styling constants ─── */

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/* ─── Types ─── */

interface BalanceTableProps {
  isChLoading: boolean;
  marginSummary?: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  } | null;
  positions: Array<{
    position: {
      coin: string;
      positionValue: string;
      unrealizedPnl: string;
      returnOnEquity: string;
    };
  }>;
  usdcTotalBalance: number;
  usdcAvailableBalance: number;
  totalUnrealizedPnl: number;
  effectiveAccountTotal: number;
  effectiveAvailableBalance: number;
}

/* ─── Component ─── */

export function BalanceTable({
  isChLoading,
  marginSummary,
  positions,
  usdcTotalBalance,
  usdcAvailableBalance,
  totalUnrealizedPnl,
  effectiveAccountTotal,
  effectiveAvailableBalance,
}: BalanceTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cHead}>Coin</TableHead>
            <TableHead className={cHeadNum}>Total Balance</TableHead>
            <TableHead className={cHeadNum}>Available Balance</TableHead>
            <TableHead className={cHeadNum}>USD Value</TableHead>
            <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
            <TableHead className={cHead}>Send</TableHead>
            <TableHead className={cHead}>Transfer</TableHead>
            <TableHead className={cHead}>Repay</TableHead>
            <TableHead className={cHead}>Contract</TableHead>
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
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-24 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-10 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-10 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
              </TableRow>
            ))
          ) : !marginSummary ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-6">
                <span className="text-sm text-muted-foreground/50 uppercase tracking-wider font-mono">
                  No balance data
                </span>
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* USDC row */}
              <TableRow>
                <TableCell className={`${c} font-medium`}>USDC</TableCell>
                <TableCell className={cNum}>{usdcTotalBalance.toFixed(2)}</TableCell>
                <TableCell className={cNum}>{usdcAvailableBalance.toFixed(2)}</TableCell>
                <TableCell className={cNum}>{formatCompactUsd(usdcTotalBalance)}</TableCell>
                <TableCell className={cNum}>
                  {totalUnrealizedPnl !== 0 ? (
                    <span className={totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}>
                      {formatCompactUsd(Math.abs(totalUnrealizedPnl))}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
              </TableRow>

              {/* Account Value row */}
              <TableRow>
                <TableCell className={`${c} font-medium`}>Account</TableCell>
                <TableCell className={cNum}>{formatCompactUsd(effectiveAccountTotal)}</TableCell>
                <TableCell className={cNum}>
                  {formatCompactUsd(effectiveAvailableBalance)}
                </TableCell>
                <TableCell className={cNum}>
                  {formatCompactUsd(Number(marginSummary.accountValue))}
                </TableCell>
                <TableCell className={cNum}>
                  {totalUnrealizedPnl !== 0 ? (
                    <span className={totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}>
                      {formatCompactUsd(Math.abs(totalUnrealizedPnl))}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>—</TableCell>
              </TableRow>

              {/* Per-position rows */}
              {positions.map(({ position }) => {
                const posValue = Number(position.positionValue);
                const upnl = Number(position.unrealizedPnl);
                const roe = Number(position.returnOnEquity);
                return (
                  <TableRow key={position.coin}>
                    <TableCell className={`${c} font-medium`}>{position.coin}</TableCell>
                    <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                    <TableCell className={cNum}>—</TableCell>
                    <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                    <TableCell className={cNum}>
                      {upnl !== 0 ? <PnLDisplay usd={upnl} pct={roe} /> : "—"}
                    </TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                  </TableRow>
                );
              })}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
