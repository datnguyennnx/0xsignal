import { useUserFills } from "../hooks/use-user-data";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { TradeHistoryTable } from "./order-history-table";

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
