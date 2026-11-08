import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { useEffect } from "react";
import { toast } from "sonner";
import { TableEmptyRow } from "@/components/table-empty-row";

import { useUserFunding } from "@/hooks/use-user-funding";
import { useWhaleFunding } from "@/features/portfolio/hooks/use-portfolio-data";
import { cHead, cHeadNum } from "@/features/trade/utils/orderbook-table-classes";
import { TableSkeletonRows } from "./shared-table-components";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { FundingHistoryRows } from "./funding-history-rows";

export function FundingHistoryTable({
  readOnlyAddress,
}: {
  readOnlyAddress?: string | undefined;
} = {}) {
  const readOnly = readOnlyAddress !== undefined;
  const own = useUserFunding(undefined, undefined, !readOnly);
  const whale = useWhaleFunding(readOnlyAddress);
  const { data: funding, isLoading, isError } = readOnly ? whale : own;
  const paginated = usePagination(funding ?? [], 20);

  useEffect(() => {
    if (isError && !readOnly) {
      toast.error("Couldn't load funding history", {
        description: "Check your connection and try again.",
      });
    }
  }, [isError, readOnly]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-stack">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cHead}>Time</TableHead>
            <TableHead className={`${cHead} font-medium`}>Coin</TableHead>
            <TableHead className={cHeadNum}>Size</TableHead>
            <TableHead className={cHead}>Position Side</TableHead>
            <TableHead className={cHeadNum}>Payment</TableHead>
            <TableHead className={cHeadNum}>Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeletonRows rows={3} colSpan={6} />
          ) : !funding || funding.length === 0 ? (
            <TableEmptyRow colSpan={6} />
          ) : (
            <FundingHistoryRows entries={paginated.pageData} />
          )}
        </TableBody>
      </Table>
      {funding && funding.length > 0 && (
        <div data-dense>
          <Pagination
            currentPage={paginated.currentPage}
            totalPages={paginated.totalPages}
            totalItems={paginated.totalItems}
            pageSize={paginated.pageSize}
            onPageChange={paginated.setPage}
            onPageSizeChange={paginated.setPageSize}
          />
        </div>
      )}
    </div>
  );
}
