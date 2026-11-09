import { Table, TableHeader, TableRow, TableHead } from "@/components/ui/table";

import { cHead, cHeadNum } from "../utils/orderbook-table-classes";
import { BalanceTableBody, type BalanceTableBodyProps } from "./balance-table-sections";

export type BalanceTableProps = BalanceTableBodyProps;

/** One column order for the header and the body rows, so the two cannot drift. */
const COLUMNS: ReadonlyArray<{ label: string; numeric: boolean }> = [
  { label: "Coin", numeric: false },
  { label: "Side", numeric: false },
  { label: "USDC Value", numeric: true },
  { label: "PNL (ROE %)", numeric: true },
  { label: "Total Balance", numeric: true },
  { label: "Available Balance", numeric: true },
];

export function BalanceTable({
  isChLoading,
  isChError,
  onRetry,
  marginSummary,
  positions,
  usdcTotalBalance,
  usdcAvailableBalance,
  totalUnrealizedPnl,
  effectiveAccountTotal,
  effectiveAvailableBalance,
  onSelectCoin,
}: BalanceTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column.label} className={column.numeric ? cHeadNum : cHead}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <BalanceTableBody
        isChLoading={isChLoading}
        isChError={isChError}
        onRetry={onRetry}
        marginSummary={marginSummary}
        positions={positions}
        usdcTotalBalance={usdcTotalBalance}
        usdcAvailableBalance={usdcAvailableBalance}
        totalUnrealizedPnl={totalUnrealizedPnl}
        effectiveAccountTotal={effectiveAccountTotal}
        effectiveAvailableBalance={effectiveAvailableBalance}
        onSelectCoin={onSelectCoin}
      />
    </Table>
  );
}
