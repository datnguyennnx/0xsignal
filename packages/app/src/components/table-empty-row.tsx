import { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

interface TableEmptyRowProps {
  colSpan: number;
}

export const TableEmptyRow = memo(function TableEmptyRow({ colSpan }: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-6">
        <EmptyState />
      </TableCell>
    </TableRow>
  );
});
