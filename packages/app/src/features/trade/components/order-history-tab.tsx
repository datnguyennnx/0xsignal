import { useHistoricalOrders } from "../hooks/use-user-data";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { HistoryOrderTable } from "./order-history-table";

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
