import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { CELL_HEAD_CLASS, CELL_HEAD_NUM_CLASS } from "../utils/orderbook-table-classes";

const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/**
 * TWAP fill history table (individual fills from TWAP orders).
 *
 * INTENTIONAL SCAFFOLD — TWAP feature is not yet implemented on the
 * backend. This component renders the correct empty state. When TWAP
 * fill data is available from the API, wire this component to the
 * appropriate data hook.
 */
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
        <TableEmptyRow colSpan={8} />
      </TableBody>
    </Table>
  );
}
