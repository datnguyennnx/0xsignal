import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/core/utils/cn";
import type { ColumnDef } from "../utils/trade-dropdown";

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
      <ArrowDown className="w-3 h-3 text-gain" />
    ) : (
      <ArrowUp className="w-3 h-3 text-loss" />
    );
  }
  if (isActive) {
    return sortDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  }
  return <ArrowUpDown className="w-3 h-3 opacity-50" />;
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
    return (
      <button
        type="button"
        onClick={() => onSort(sortField)}
        className={cn(
          "hover:text-foreground transition-colors flex items-center gap-[clamp(0.15rem,0.3vw,0.25rem)] cursor-pointer bg-transparent border-none p-0 w-full whitespace-nowrap",
          col.align === "right" && "justify-end",
        )}
      >
        <span className="truncate">{col.label}</span>
        <SortIcon sortBy={sortBy} sortField={sortField} sortDesc={sortDesc} />
      </button>
    );
  }

  return (
    <span className={cn("w-full whitespace-nowrap", col.align === "right" && "text-right block")}>
      {col.label}
    </span>
  );
}
