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
 * Active TWAP orders table.
 *
 * INTENTIONAL SCAFFOLD — TWAP order placement and querying is not yet
 * implemented on the backend. This component renders the correct empty
 * state for users who have never placed a TWAP order. When the TWAP
 * feature is added to the backend API, wire this component to the
 * appropriate `useHyperliquid*` or API hook.
 */
export function TwapActiveTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Executed Size</TableHead>
          <TableHead className={cHeadNum}>Average Price</TableHead>
          <TableHead className={cHead}>Running Time / Total</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Creation Time</TableHead>
          <TableHead className={cHead}>Terminate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={8} className="text-center py-6">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
              No active TWAP orders
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
