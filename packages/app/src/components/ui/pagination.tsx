import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const buildPageNumbers = (currentPage: number, totalPages: number) => {
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }
  return pages;
};

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [20, 50, 100],
  className,
}: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3",
        className
      )}
    >
      {/* Results count */}
      <span className="text-xs text-muted-foreground font-mono tabular-nums order-1">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()}
      </span>

      {/* Page controls */}
      <div className="flex items-center gap-0.5 order-2">
        {/* Previous */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded text-xs transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            "disabled:pointer-events-none disabled:opacity-30"
          )}
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((page, i) =>
          typeof page === "number" ? (
            <button
              key={i}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                "inline-flex items-center justify-center h-7 min-w-[1.75rem] rounded text-xs font-mono tabular-nums transition-colors",
                currentPage === page
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {page}
            </button>
          ) : (
            <span
              key={i}
              className="inline-flex items-center justify-center h-7 w-5 text-xs text-muted-foreground/50 select-none"
            >
              ...
            </span>
          )
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className={cn(
            "inline-flex items-center justify-center h-7 w-7 rounded text-xs transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            "disabled:pointer-events-none disabled:opacity-30"
          )}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2 order-3">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">Show</span>
          <NativeSelect
            size="sm"
            aria-label="Rows per page"
            value={pageSize.toString()}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            wrapperClassName="min-w-[4rem] max-w-[4rem]"
            className="h-7 text-xs text-center px-1"
          >
            {pageSizeOptions.map((size) => (
              <NativeSelectOption key={size} value={size.toString()}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
});
