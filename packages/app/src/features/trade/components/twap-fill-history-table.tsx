/**
 * TWAP Fill History Table — displays individual fills from TWAP orders.
 *
 * Column matrix: Time, Coin, Direction, Price, Size, Trade Value, Fee, Closed PNL
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

export function TwapFillHistoryTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHead}>Direction</TableHead>
          <TableHead className={cHeadNum}>Price</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Trade Value</TableHead>
          <TableHead className={cHeadNum}>Fee</TableHead>
          <TableHead className={cHeadNum}>Closed PNL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={8} className="text-center py-6">
            <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
              No TWAP fill history
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
