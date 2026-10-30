import { Table, TableHeader, TableRow, TableHead } from "@/components/ui/table";

import { cHead, cHeadNum } from "../utils/orderbook-table-classes";
import { BalanceTableBody, type BalanceTableBodyProps } from "./balance-table-sections";

export type BalanceTableProps = BalanceTableBodyProps;

export function BalanceTable({
  isChLoading,
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
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHead}>Side</TableHead>
          <TableHead className={cHeadNum}>USDC Value</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHeadNum}>Total Balance</TableHead>
          <TableHead className={cHeadNum}>Available Balance</TableHead>
          <TableHead className={cHead}>Send</TableHead>
          <TableHead className={cHead}>Transfer</TableHead>
          <TableHead className={cHead}>Repay</TableHead>
          <TableHead className={cHead}>Contract</TableHead>
        </TableRow>
      </TableHeader>
      <BalanceTableBody
        isChLoading={isChLoading}
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
