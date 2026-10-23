import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd } from "@/core/utils/formatters";

import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import { PnLDisplay } from "./shared-table-components";

const SKELETON_ROW_COUNT = 2;

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

interface BalanceTableProps {
  isChLoading: boolean;
  marginSummary?:
    | {
        accountValue: string;
        totalNtlPos: string;
        totalRawUsd: string;
        totalMarginUsed: string;
      }
    | null
    | undefined;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Total Balance</TableHead>
          <TableHead className={cHeadNum}>Available Balance</TableHead>
          <TableHead className={cHeadNum}>USDC Value</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHead}>Send</TableHead>
          <TableHead className={cHead}>Transfer</TableHead>
          <TableHead className={cHead}>Repay</TableHead>
          <TableHead className={cHead}>Contract</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isChLoading ? (
          <TableSkeletonRows columns={9} />
        ) : marginSummary ? (
          <>
            <TableRow>
              <TableCell className={`${c} font-medium`}>USDC</TableCell>
              <TableCell className={cNum}>{formatCompactUsd(usdcTotalBalance)}</TableCell>
              <TableCell className={cNum}>{formatCompactUsd(usdcAvailableBalance)}</TableCell>
              <TableCell className={cNum}>{formatCompactUsd(usdcTotalBalance)}</TableCell>
              <TableCell className={cNum}>
                {totalUnrealizedPnl === 0 ? (
                  "—"
                ) : (
                  <span className={totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}>
                    {formatCompactUsd(totalUnrealizedPnl)}
                  </span>
                )}
              </TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
            </TableRow>

            <TableRow>
              <TableCell className={`${c} font-medium`}>Account</TableCell>
              <TableCell className={cNum}>{formatCompactUsd(effectiveAccountTotal)}</TableCell>
              <TableCell className={cNum}>{formatCompactUsd(effectiveAvailableBalance)}</TableCell>
              <TableCell className={cNum}>
                {formatCompactUsd(Number(marginSummary.accountValue))}
              </TableCell>
              <TableCell className={cNum}>
                {totalUnrealizedPnl === 0 ? (
                  "—"
                ) : (
                  <span className={totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}>
                    {formatCompactUsd(totalUnrealizedPnl)}
                  </span>
                )}
              </TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
              <TableCell className={c}>—</TableCell>
            </TableRow>

            {positions.map(({ position }) => {
              const posValue = Number(position.positionValue);
              const upnl = Number(position.unrealizedPnl);
              const roe = Number(position.returnOnEquity) * 100;
              return (
                <TableRow key={position.coin}>
                  <TableCell className={`${c} font-medium`}>{position.coin}</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                  <TableCell className={cNum}>—</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                  <TableCell className={cNum}>
                    {upnl === 0 ? "—" : <PnLDisplay usd={upnl} pct={roe} />}
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
          <TableEmptyRow colSpan={9} />
        )}
      </TableBody>
    </Table>
  );
}
