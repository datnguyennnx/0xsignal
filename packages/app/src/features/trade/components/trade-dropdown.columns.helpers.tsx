import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "cn";
import type { ColumnDef } from "../utils/trade-dropdown-columns";

const SortIcon = ({
  sortBy,
  sortField,
  sortDesc,
}: {
  sortBy: "name" | "change";
  sortField: "name" | "change";
  sortDesc: boolean;
}) => {
  const isActive = sortBy === sortField;
  if (sortField === "change" && isActive) {
    return sortDesc ? (
      <ArrowDown className="size-icon-sm text-foreground" />
    ) : (
      <ArrowUp className="size-icon-sm text-foreground" />
    );
  }
  if (isActive) {
    return sortDesc ? (
      <ArrowDown className="size-icon-sm text-foreground" />
    ) : (
      <ArrowUp className="size-icon-sm text-foreground" />
    );
  }
  return <ArrowUpDown className="size-icon-sm text-foreground" />;
};

export function HeaderCell({
  col,
  sortBy,
  sortDesc,
  onSort,
}: {
  col: ColumnDef;
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
}) {
  const sortField = col.id === "change" ? "change" : col.id === "symbol" ? "name" : undefined;

  if (sortField) {
    const isRight = col.align === "right";
    const icon = <SortIcon sortBy={sortBy} sortField={sortField} sortDesc={sortDesc} />;
    return (
      <button
        type="button"
        onClick={() => {
          onSort(sortField);
        }}
        className={cn(
          "hover:text-foreground transition-colors flex min-w-0 items-center gap-1 cursor-pointer bg-transparent border-none p-0 w-full whitespace-nowrap",
          isRight && "justify-end",
        )}
      >
        {isRight && icon}
        <span className="min-w-0 truncate">{col.label}</span>
        {!isRight && icon}
      </button>
    );
  }

  return (
    <span
      className={cn(
        "block w-full min-w-0 truncate",
        col.align === "right" ? "text-right" : "text-left",
      )}
    >
      {col.label}
    </span>
  );
}
