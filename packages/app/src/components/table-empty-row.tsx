import { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import type { AsyncStatus } from "@/lib/async-state";

interface TableEmptyRowProps {
  colSpan: number;
  /** The table query's status; a "ready" table renders its own rows instead. */
  status: AsyncStatus;
  /** Only rendered for the error state. */
  onRetry?: (() => void) | undefined;
  /** Skeleton row count while loading. */
  rows?: number;
  /** Names the object and the next step; there is no generic fallback. */
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
}

function TableLoadingRows({ rows, colSpan }: { rows: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="py-2">
            {rowIndex === 0 && (
              <output aria-live="polite" aria-busy="true" className="sr-only">
                Loading data
              </output>
            )}
            <div className="flex items-center gap-4" aria-hidden="true">
              {Array.from({ length: colSpan }, (_column, columnIndex) => (
                <Skeleton key={columnIndex} className="h-[1.5em] flex-1" />
              ))}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export const TableEmptyRow = memo(function TableEmptyRow({
  colSpan,
  status,
  onRetry,
  rows = 3,
  emptyTitle,
  emptyDescription,
  errorTitle,
  errorDescription,
}: TableEmptyRowProps) {
  if (status === "loading") {
    return <TableLoadingRows rows={rows} colSpan={colSpan} />;
  }

  if (status === "error") {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="p-0">
          <div role="alert">
            <ErrorState
              {...(errorTitle === undefined ? {} : { title: errorTitle })}
              {...(errorDescription === undefined ? {} : { description: errorDescription })}
              retryAction={onRetry}
              size="sm"
              className="py-6"
            />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-6">
        <EmptyState
          title={emptyTitle}
          {...(emptyDescription === undefined ? {} : { description: emptyDescription })}
        />
      </TableCell>
    </TableRow>
  );
});
