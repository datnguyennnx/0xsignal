import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCompactUsd } from "@/core/utils/formatters";
import { TableSkeleton, PnLDisplay } from "./shared-table-utils";

/* ─── Styling constants ─── */

const c = "px-4 py-2 text-xs whitespace-nowrap";
const cNum = "px-4 py-2 text-xs text-right tabular-nums whitespace-nowrap";
const cHead =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";
const cHeadNum =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";

/* ─── Types ─── */

interface BalanceTableProps {
  chLoading: boolean;
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
  chLoading,
  marginSummary,
  positions,
  usdcTotalBalance,
  usdcAvailableBalance,
  totalUnrealizedPnl,
  effectiveAccountTotal,
  effectiveAvailableBalance,
}: BalanceTableProps) {
  if (chLoading) {
    return <TableSkeleton rows={3} cols={9} />;
  }

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
          {marginSummary ? (
            <>
              {/* USDC row */}
              <TableRow className="border-b border-border/20">
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

              {/* Account Value row — uses effective values with perps-aware fallback */}
              <TableRow className="border-b border-border/20">
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
                  <TableRow key={position.coin} className="border-b border-border/20">
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
          ) : (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-4 text-xs">
                No balance data yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
