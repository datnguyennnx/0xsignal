import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSize } from "@/core/utils/formatters";
import { formatTime } from "../utils/shared-table-utils";
import { DirLabel } from "./shared-table-components";

import {
  getOrderType,
  getTriggerLabel,
  formatOrderValue,
  formatOrderPrice,
} from "../utils/trigger-utils";
import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import type { FrontendOpenOrder, OpenOrder } from "@0xsignal/shared";

const SKELETON_ROW_COUNT = 3;

/** Child TP/SL orders only exist on the enriched own-account read. */
function isFrontendOpenOrder(order: OpenOrder): order is FrontendOpenOrder {
  return "children" in order && Array.isArray(order.children);
}

/** Same 1.5em line box as a loaded `c` cell, so a placeholder row is exactly one row tall. */
function TableSkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          <TableCell colSpan={columns} className={c}>
            <div className="flex items-center gap-4">
              {Array.from({ length: columns }, (_column, columnIndex) => (
                <Skeleton key={columnIndex} className="h-[1.5em] flex-1" />
              ))}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface OpenOrdersTableProps {
  isOoLoading: boolean;
  openOrders: OpenOrder[] | undefined;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
  orderCount: number;
  /** A third party's account: render rows only, no cancel or TP/SL affordance. */
  readOnly?: boolean;
}

export function OpenOrdersTable({
  isOoLoading,
  openOrders,
  onCancelOrder,
  onViewTpSl,
  onCancelAll,
  isCancelPending,
  orderCount,
  readOnly = false,
}: OpenOrdersTableProps) {
  const columnCount = readOnly ? 11 : 12;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Type</TableHead>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHead}>Direction</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Original Size</TableHead>
          <TableHead className={cHeadNum}>Order Value</TableHead>
          <TableHead className={cHeadNum}>Price</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Trigger Conditions</TableHead>
          <TableHead className={cHead}>TP/SL</TableHead>
          {!readOnly && (
            <TableHead className={cHeadNum}>
              <Button
                type="button"
                variant="ghost"
                size="auto"
                onClick={onCancelAll}
                disabled={orderCount === 0 || isCancelPending}
                className="text-xs uppercase tracking-wider hover:bg-transparent hover:text-inherit disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-auto dark:hover:bg-transparent"
              >
                Cancel All
              </Button>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isOoLoading ? (
          <TableSkeletonRows columns={columnCount} />
        ) : !openOrders || openOrders.length === 0 ? (
          <TableEmptyRow colSpan={columnCount} />
        ) : (
          openOrders.map((order) => {
            const sz = Number(order.sz);
            const origSz =
              order.origSz !== undefined && order.origSz !== "" ? Number(order.origSz) : sz;
            const limitPx = Number(order.limitPx);
            return (
              <TableRow key={`${order.oid}-${order.coin}`}>
                <TableCell className={c}>{formatTime(order.timestamp)}</TableCell>
                <TableCell className={c}>{readOnly ? "—" : getOrderType(order)}</TableCell>
                <TableCell className={`${c} font-medium`}>{order.coin}</TableCell>
                <TableCell className={c}>
                  <DirLabel side={order.side} reduceOnly={order.reduceOnly} />
                </TableCell>
                <TableCell className={cNum}>{formatSize(sz)}</TableCell>
                <TableCell className={cNum}>{origSz === sz ? "—" : formatSize(origSz)}</TableCell>
                <TableCell className={cNum}>{formatOrderValue(order, sz, limitPx)}</TableCell>
                <TableCell className={cNum}>{formatOrderPrice(order, limitPx)}</TableCell>
                <TableCell className={c}>{order.reduceOnly === true ? "Yes" : "No"}</TableCell>
                <TableCell className={c}>{getTriggerLabel(order)}</TableCell>
                <TableCell className={c}>
                  {!readOnly && isFrontendOpenOrder(order) && order.children.length > 0 ? (
                    <Button
                      type="button"
                      variant="link"
                      size="auto"
                      onClick={() => {
                        onViewTpSl(order);
                      }}
                      className="cursor-pointer text-sm text-gain underline-offset-2"
                    >
                      View
                    </Button>
                  ) : (
                    "—"
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell className={cNum}>
                    <Button
                      type="button"
                      variant="link"
                      size="auto"
                      onClick={() => {
                        onCancelOrder(order.coin, order.oid);
                      }}
                      disabled={isCancelPending}
                      className="cursor-pointer text-sm text-inherit underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40 disabled:pointer-events-auto"
                    >
                      Cancel
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
