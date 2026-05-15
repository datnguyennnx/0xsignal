import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatTime, fmtNum } from "./shared-table-utils";
import { DirLabel } from "./shared-table-components";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOrderType,
  getTriggerLabel,
  formatOrderValue,
  formatOrderPrice,
} from "../utils/trigger-utils";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "./orderbook-table-classes";
import type { FrontendOpenOrder } from "@0xsignal/shared";

/* ─── Styling constants ─── */

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/* ─── Types ─── */

interface OpenOrdersTableProps {
  isOoLoading: boolean;
  openOrders: FrontendOpenOrder[] | undefined;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
  onCancelAll: () => void;
  isCancelPending: boolean;
  orderCount: number;
}

/* ─── Component ─── */

export function OpenOrdersTable({
  isOoLoading,
  openOrders,
  onCancelOrder,
  onViewTpSl,
  onCancelAll,
  isCancelPending,
  orderCount,
}: OpenOrdersTableProps) {
  return (
    <div className="w-full overflow-x-auto">
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
            <TableHead className={cHeadNum}>
              <button
                onClick={onCancelAll}
                disabled={orderCount === 0 || isCancelPending}
                className="text-[0.65rem] font-medium uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel All
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isOoLoading ? (
            // Skeleton rows — 3 rows with approximate column widths
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-28 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-14 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-14 rounded-sm" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-14 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-14 rounded-sm ml-auto" />
                </TableCell>
              </TableRow>
            ))
          ) : !openOrders || openOrders.length === 0 ? (
            // Empty state — minimalist single row
            <TableRow>
              <TableCell colSpan={12} className="text-center py-6">
                <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                  No open orders
                </span>
              </TableCell>
            </TableRow>
          ) : (
            // Data rows — keep existing map
            openOrders.map((order) => {
              const sz = Number(order.sz);
              const origSz = order.origSz ? Number(order.origSz) : sz;
              const limitPx = Number(order.limitPx);
              return (
                <TableRow key={order.oid} className="border-b border-border/20">
                  <TableCell className={c}>{formatTime(order.timestamp)}</TableCell>
                  <TableCell className={c}>{getOrderType(order)}</TableCell>
                  <TableCell className={`${c} font-medium`}>{order.coin}</TableCell>
                  <TableCell className={c}>
                    <DirLabel side={order.side} reduceOnly={order.reduceOnly} />
                  </TableCell>
                  <TableCell className={cNum}>{fmtNum(sz)}</TableCell>
                  <TableCell className={cNum}>{origSz !== sz ? fmtNum(origSz) : "—"}</TableCell>
                  <TableCell className={cNum}>{formatOrderValue(order, sz, limitPx)}</TableCell>
                  <TableCell className={cNum}>{formatOrderPrice(order, limitPx)}</TableCell>
                  <TableCell className={c}>{order.reduceOnly ? "Yes" : "No"}</TableCell>
                  <TableCell className={c}>{getTriggerLabel(order)}</TableCell>
                  <TableCell className={c}>
                    {order.children?.length > 0 ? (
                      <button
                        onClick={() => onViewTpSl(order)}
                        className="text-gain hover:text-gain-light text-xs font-medium transition-colors"
                      >
                        View
                      </button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className={cNum}>
                    <button
                      onClick={() => onCancelOrder(order.coin, order.oid)}
                      disabled={isCancelPending}
                      className="text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
