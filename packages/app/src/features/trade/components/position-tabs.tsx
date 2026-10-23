import { useHistoricalOrders, useUserFills } from "../hooks/use-user-data";
import { useUserBalances } from "../hooks/use-user-balances";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { HistoryOrderTable, TradeHistoryTable } from "./order-history-table";
import { BalanceTable } from "./balance-table";

/**
 * Wrapper for the Order History tab content.
 * Internally calls useHistoricalOrders() and manages its own pagination state.
 */
export function OrderHistoryTab() {
  const { data: histOrders, isLoading: isHistLoading } = useHistoricalOrders();
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
 * Wrapper for the Trade History tab content.
 * Internally calls useUserFills() and manages its own pagination state.
 */
export function TradeHistoryTab() {
  const { data: fills, isLoading: isFillsLoading } = useUserFills();
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
 * Wrapper for the Balances tab content.
 * Internally calls useUserBalances() instead of receiving data via props
 * from a shared parent state blob.
 */
export function BalancesTab() {
  const {
    isChLoading,
    marginSummary,
    positions,
    usdcTotalBalance,
    usdcAvailableBalance,
    totalUnrealizedPnl,
    effectiveAccountTotal,
    effectiveAvailableBalance,
  } = useUserBalances();

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
    />
  );
}
