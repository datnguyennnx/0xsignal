import { memo } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

interface TableEmptyRowProps {
  colSpan: number;
  title?: string;
  description?: string;
}

export const TableEmptyRow = memo(function TableEmptyRow({
  colSpan,
  title,
  description,
}: TableEmptyRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10">
        <EmptyState variant="table" title={title} description={description} />
      </TableCell>
    </TableRow>
  );
});
