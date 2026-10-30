import { useHistoricalOrders, useUserFills } from "../hooks/use-user-data";
import { useUserBalances, useWhaleBalances } from "../hooks/use-user-balances";
import {
  useWhaleFills,
  useWhaleHistoricalOrders,
} from "@/features/portfolio/hooks/use-portfolio-data";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { useCoinContextPanel } from "@/components/app-side-panel";
import { HistoryOrderTable, TradeHistoryTable } from "./order-history-table";
import { BalanceTable } from "./balance-table";

/**
 * Wrapper for the Order History tab content. Read-only mode reads the third
 * party's records from the public endpoint instead of the own-account route.
 */
export function OrderHistoryTab({ readOnlyAddress }: { readOnlyAddress?: string | undefined }) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useHistoricalOrders(!readOnly);
  const whale = useWhaleHistoricalOrders(readOnlyAddress);
  const { data: histOrders, isLoading: isHistLoading } = readOnly ? whale : own;
  const paginated = usePagination(histOrders ?? [], 20);

  return (
    <>
      <HistoryOrderTable histOrders={paginated.pageData} isHistLoading={isHistLoading} />
      <Pagination
        currentPage={paginated.currentPage}
        totalPages={paginated.totalPages}
        totalItems={paginated.totalItems}
        pageSize={paginated.pageSize}
        onPageChange={paginated.setPage}
        onPageSizeChange={paginated.setPageSize}
      />
    </>
  );
}

/**
 * Wrapper for the Trade History tab content. Read-only mode reads the third
 * party's fills from the public endpoint.
 */
export function TradeHistoryTab({ readOnlyAddress }: { readOnlyAddress?: string | undefined }) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useUserFills(!readOnly);
  const whale = useWhaleFills(readOnlyAddress);
  const { data: fills, isLoading: isFillsLoading } = readOnly ? whale : own;
  const paginated = usePagination(fills ?? [], 20);

  return (
    <>
      <TradeHistoryTable fills={paginated.pageData} isFillsLoading={isFillsLoading} />
      <Pagination
        currentPage={paginated.currentPage}
        totalPages={paginated.totalPages}
        totalItems={paginated.totalItems}
        pageSize={paginated.pageSize}
        onPageChange={paginated.setPage}
        onPageSizeChange={paginated.setPageSize}
      />
    </>
  );
}

/**
 * Wrapper for the Balances tab content. Read-only mode derives the same shape
 * from the public clearinghouse and spot reads.
 */
export function BalancesTab({ readOnlyAddress }: { readOnlyAddress?: string | undefined }) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useUserBalances(!readOnly);
  const whale = useWhaleBalances(readOnlyAddress);
  const {
    isChLoading,
    marginSummary,
    positions,
    usdcTotalBalance,
    usdcAvailableBalance,
    totalUnrealizedPnl,
    effectiveAccountTotal,
    effectiveAvailableBalance,
  } = readOnly ? whale : own;
  const { openCoin } = useCoinContextPanel();

  return (
    <BalanceTable
      isChLoading={isChLoading}
      marginSummary={marginSummary}
      positions={positions}
      usdcTotalBalance={usdcTotalBalance}
      usdcAvailableBalance={usdcAvailableBalance}
      totalUnrealizedPnl={totalUnrealizedPnl}
      effectiveAccountTotal={effectiveAccountTotal}
      effectiveAvailableBalance={effectiveAvailableBalance}
      onSelectCoin={readOnly ? openCoin : undefined}
    />
  );
}
