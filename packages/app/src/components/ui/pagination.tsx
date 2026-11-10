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
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-stack pt-3",
        className,
      )}
    >
      <span className="num type-label text-muted-foreground order-1">
        {formatAxis(start)}–{formatAxis(end)} of {formatAxis(totalItems)}
      </span>

      <div className="flex items-center gap-1 order-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            onPageChange(currentPage - 1);
          }}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="hit-area text-muted-foreground"
        >
          <ChevronLeft className="size-icon" />
        </Button>

        {pageNumbers.map(({ key, value }) => {
          if (typeof value !== "number") {
            return (
              <span
                key={key}
                className="inline-flex items-center justify-center h-control w-5 type-control text-muted-foreground select-none"
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
              size="icon"
              onClick={() => {
                onPageChange(value);
              }}
              className={cn(
                "num hit-area",
                currentPage === value
                  ? cn(SELECTED_ITEM_CLASS, "hover:bg-(--control-active-bg) hover:text-foreground")
                  : "text-muted-foreground hover:bg-(--control-hover-bg) hover:text-foreground",
              )}
            >
              {value}
            </Button>
          );
        })}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            onPageChange(currentPage + 1);
          }}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="hit-area text-muted-foreground"
        >
          <ChevronRight className="size-icon" />
        </Button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-inline order-3">
          <span className="num type-label text-muted-foreground">Show</span>
          <NativeSelect
            aria-label="Rows per page"
            value={pageSize.toString()}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
            }}
            wrapperClassName="w-16"
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
