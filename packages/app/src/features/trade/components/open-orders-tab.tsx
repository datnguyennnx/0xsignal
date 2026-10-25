import { useOpenOrders } from "../hooks/use-user-data";
import { useWhaleOpenOrders } from "@/features/portfolio/hooks/use-portfolio-data";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { OpenOrdersTable } from "./open-orders-table";
import type { FrontendOpenOrder, OpenOrder } from "@0xsignal/shared";

interface OpenOrdersTabProps {
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
  readOnlyAddress?: string | undefined;
}

/**
 * Wrapper for the Open Orders tab content. In read-only mode the rows come from
 * the public endpoint and no cancel affordance is rendered at all.
 */
export function OpenOrdersTab({
  onCancelOrder,
  onViewTpSl,
  onCancelAll,
  isCancelPending,
  readOnlyAddress,
}: OpenOrdersTabProps) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useOpenOrders(!readOnly);
  const whale = useWhaleOpenOrders(readOnlyAddress);
  const { data: selectedOrders, isLoading: isOoLoading } = readOnly ? whale : own;
  const openOrders: OpenOrder[] | undefined = selectedOrders;
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
        readOnly={readOnly}
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
