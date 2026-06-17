import { useOpenOrders } from "../hooks/use-user-data";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { OpenOrdersTable } from "./open-orders-table";
import type { FrontendOpenOrder } from "@0xsignal/shared";

interface OpenOrdersTabProps {
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
}

/**
 * Wrapper for the Open Orders tab content.
 * Internally calls useOpenOrders() and manages its own pagination state.
 */
export function OpenOrdersTab({
  onCancelOrder,
  onViewTpSl,
  onCancelAll,
  isCancelPending,
}: OpenOrdersTabProps) {
  const { data: openOrders, isLoading: isOoLoading } = useOpenOrders();
  const paginated = usePagination(openOrders ?? [], 20);
  const orderCount = openOrders?.length ?? 0;

  return (
    <>
      <OpenOrdersTable
        isOoLoading={isOoLoading}
        openOrders={paginated.pageData}
        onCancelOrder={onCancelOrder}
        onViewTpSl={onViewTpSl}
        onCancelAll={onCancelAll}
        isCancelPending={isCancelPending}
        orderCount={orderCount}
      />
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
