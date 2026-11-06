import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "cn";
import { formatAxis } from "@/core/utils/formatters";
import { SELECTED_ITEM_CLASS } from "@/lib/state-classes";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface PageEntry {
  key: string;
  value: number | "ellipsis";
}

const buildPageNumbers = (currentPage: number, totalPages: number): PageEntry[] => {
  const pages: PageEntry[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push({ key: `page-${i}`, value: i });
  } else {
    pages.push({ key: "page-1", value: 1 });
    if (currentPage > 3) pages.push({ key: "ellipsis-start", value: "ellipsis" });
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push({ key: `page-${i}`, value: i });
    if (currentPage < totalPages - 2) pages.push({ key: "ellipsis-end", value: "ellipsis" });
    pages.push({ key: `page-${totalPages}`, value: totalPages });
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
  className,
}: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3",
        className,
      )}
    >
      <span className="text-[length:var(--control-text-xs)] text-muted-foreground tabular-nums order-1">
        {formatAxis(start)}–{formatAxis(end)} of {formatAxis(totalItems)}
      </span>

      <div className="flex items-center gap-0.5 order-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onPageChange(currentPage - 1);
          }}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="text-muted-foreground min-w-[40px] min-h-[40px] after:hidden"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {pageNumbers.map(({ key, value }) => {
          if (typeof value !== "number") {
            return (
              <span
                key={key}
                className="inline-flex items-center justify-center h-[var(--control-h-sm)] w-5 text-[length:var(--control-text-xs)] text-muted-foreground/60 select-none"
              >
                ...
              </span>
            );
          }

          return (
            <Button
              key={key}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                onPageChange(value);
              }}
              className={cn(
                "tabular-nums min-w-[40px] min-h-[40px] after:hidden",
                currentPage === value
                  ? cn(SELECTED_ITEM_CLASS, "hover:bg-accent hover:text-accent-foreground")
                  : "text-muted-foreground",
              )}
            >
              {value}
            </Button>
          );
        })}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            onPageChange(currentPage + 1);
          }}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="text-muted-foreground min-w-[40px] min-h-[40px] after:hidden"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-2 order-3">
          <span className="text-[length:var(--control-text-xs)] text-muted-foreground tabular-nums">
            Show
          </span>
          <NativeSelect
            size="sm"
            aria-label="Rows per page"
            value={pageSize.toString()}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            wrapperClassName="min-w-[4rem] max-w-[4rem]"
            className="h-[var(--control-h-sm)] px-[var(--control-px-xs)] text-center text-[length:var(--control-text-xs)]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
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
