/**
 * Outcomes Table — displays outcome market positions (prediction markets).
 *
 * Column matrix: Outcome, Size, Position Value, Entry Price, Mark Price, PNL (ROE %), Close All
 *
 * @note Backend data source not yet implemented. Renders empty state.
 */
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CELL_HEAD_CLASS, CELL_HEAD_NUM_CLASS } from "./orderbook-table-classes";

const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

export function OutcomesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Outcome</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Position Value</TableHead>
          <TableHead className={cHeadNum}>Entry Price</TableHead>
          <TableHead className={cHeadNum}>Mark Price</TableHead>
          <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
          <TableHead className={cHead}>Close All</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={7} className="text-center py-6">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-wider">
              Not available
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
