import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { useEffect } from "react";
import { toast } from "sonner";
import { useUserFunding } from "@/hooks/use-user-funding";
import { useWhaleFunding } from "@/features/portfolio/hooks/use-portfolio-data";
import { cHead, cHeadNum } from "@/features/trade/utils/orderbook-table-classes";
import { TableEmptyRow, resolveTableState } from "./shared-table-components";
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
  const { data: funding, isLoading, isError, refetch } = readOnly ? whale : own;
  const paginated = usePagination(funding ?? [], 20);
  const state = resolveTableState({ isLoading, isError });

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
          {state === "empty" ? (
            !funding || funding.length === 0 ? (
              <TableEmptyRow colSpan={6} />
            ) : (
              <FundingHistoryRows entries={paginated.pageData} />
            )
          ) : (
            <TableEmptyRow
              colSpan={6}
              state={state}
              onRetry={() => {
                void refetch();
              }}
              errorTitle="Couldn't load funding history"
              errorDescription="The funding request failed. Check your connection and try again."
            />
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
