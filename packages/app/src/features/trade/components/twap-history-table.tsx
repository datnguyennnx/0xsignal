import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CELL_HEAD_CLASS, CELL_HEAD_NUM_CLASS } from "../utils/orderbook-table-classes";

const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/**
 * Historical (settled) TWAP orders table.
 *
 * INTENTIONAL SCAFFOLD — TWAP feature is not yet implemented on the
 * backend. This component renders the correct empty state. When a TWAP
 * history endpoint exists in the API, wire this component to the
 * appropriate data hook.
 */
export function TwapHistoryTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Total Size</TableHead>
          <TableHead className={cHeadNum}>Executed Size</TableHead>
          <TableHead className={cHeadNum}>Average Price</TableHead>
          <TableHead className={cHead}>Total Runtime</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Randomize</TableHead>
          <TableHead className={cHead}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={9} className="text-center py-6">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
              No TWAP history
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
