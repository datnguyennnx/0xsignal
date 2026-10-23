import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useEffect } from "react";
import { toast } from "sonner";
import { TableEmptyRow } from "@/components/table-empty-row";

import { useUserFunding } from "@/hooks/use-user-funding";
import { cHead, cHeadNum, TABLE_HEAD_CLASS } from "@/features/trade/utils/orderbook-table-classes";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import { FundingHistoryRows } from "./funding-history-rows";

export function FundingHistoryTable() {
  const { data: funding, isLoading, isError } = useUserFunding();
  const paginated = usePagination(funding ?? [], 20);

  useEffect(() => {
    if (isError) {
      toast.error("Couldn't load funding history", {
        description: "Check your connection and try again.",
      });
    }
  }, [isError]);

  return (
    <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cHead}>Time</TableHead>
            <TableHead className={cHead}>Coin</TableHead>
            <TableHead className={cHeadNum}>Size</TableHead>
            <TableHead className={cHead}>Position Side</TableHead>
            <TableHead className={cHeadNum}>Payment</TableHead>
            <TableHead className={cHeadNum}>Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                <span className={TABLE_HEAD_CLASS}>Loading...</span>
              </TableCell>
            </TableRow>
          ) : !funding || funding.length === 0 ? (
            <TableEmptyRow colSpan={6} />
          ) : (
            <FundingHistoryRows entries={paginated.pageData} />
          )}
        </TableBody>
      </Table>
      {funding && funding.length > 0 && (
        <Pagination
          currentPage={paginated.currentPage}
          totalPages={paginated.totalPages}
          totalItems={paginated.totalItems}
          pageSize={paginated.pageSize}
          onPageChange={paginated.setPage}
          onPageSizeChange={paginated.setPageSize}
        />
      )}
    </div>
  );
}
