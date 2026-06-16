import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import { useUserFunding } from "@/features/portfolio/hooks/use-portfolio-data";
import { formatTime, fmtNum } from "@/features/trade/utils/shared-table-utils";
import { formatCompactUsd } from "@/core/utils/formatters";
import { PosDirLabel } from "@/features/trade/components/shared-table-components";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "@/features/trade/utils/orderbook-table-classes";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

export function FundingHistoryTable() {
  const { data: funding, isLoading, isError } = useUserFunding();
  const paginated = usePagination(funding ?? [], 20);

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
                <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
                  Loading...
                </span>
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                <span className="text-xs text-destructive/70 uppercase tracking-wider">
                  Unable to load funding history
                </span>
              </TableCell>
            </TableRow>
          ) : !funding || funding.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
                  No funding history
                </span>
              </TableCell>
            </TableRow>
          ) : (
            paginated.pageData.map((entry, idx) => {
              const usdc = Number(entry.delta.usdc);
              return (
                <TableRow key={`${entry.hash}-${entry.time}-${idx}`}>
                  <TableCell className={c}>{formatTime(entry.time)}</TableCell>
                  <TableCell className={`${c} font-medium`}>{entry.delta.coin}</TableCell>
                  <TableCell className={cNum}>{fmtNum(Number(entry.delta.szi))}</TableCell>
                  <TableCell className={c}>
                    <PosDirLabel szi={entry.delta.szi} />
                  </TableCell>
                  <TableCell className={`${cNum} ${usdc >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCompactUsd(Math.abs(usdc))}
                  </TableCell>
                  <TableCell className={cNum}>
                    {(Number(entry.delta.fundingRate) * 100).toFixed(6)}%
                  </TableCell>
                </TableRow>
              );
            })
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
