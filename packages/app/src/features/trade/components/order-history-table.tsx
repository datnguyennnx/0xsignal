import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatCompactUsd } from "@/core/utils/formatters";
import { formatTime, fmtNum, formatStatus } from "./shared-table-utils";
import { SideLabel, DirLabel } from "./shared-table-components";
import { getOrderType, getTriggerLabel, formatOrderValue } from "../utils/trigger-utils";
import type { UserFill, HistoricalOrderEntry } from "@0xsignal/shared";

/* ─── Styling constants ─── */

const c = "px-4 py-2 text-xs whitespace-nowrap";
const cNum = "px-4 py-2 text-xs text-right tabular-nums whitespace-nowrap";
const cHead =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";
const cHeadNum =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";

/* ─── Types ─── */

interface TradeHistoryTableProps {
  fills?: UserFill[];
  fillsLoading: boolean;
}

interface HistoryOrderTableProps {
  histOrders?: HistoricalOrderEntry[];
  histLoading: boolean;
}

/* ─── Trade History (fills) ─── */

export function TradeHistoryTable({ fills, fillsLoading }: TradeHistoryTableProps) {
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
        {fillsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className={c}>
                <Skeleton className="h-3 w-28 rounded-sm" />
              </TableCell>
              <TableCell className={c}>
                <Skeleton className="h-3 w-12 rounded-sm" />
              </TableCell>
              <TableCell className={c}>
                <Skeleton className="h-3 w-14 rounded-sm" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-20 rounded-sm ml-auto" />
              </TableCell>
            </TableRow>
          ))
        ) : !fills || fills.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                No trade history
              </span>
            </TableCell>
          </TableRow>
        ) : (
          fills.map((fill) => {
            const sz = Number(fill.sz);
            const px = Number(fill.px);
            const tradeValue = sz * px;
            const fee = Number(fill.fee);
            const cpnl = fill.closedPnl ? Number(fill.closedPnl) : null;
            return (
              <TableRow key={fill.hash} className="border-b border-border/30">
                <TableCell className={c}>{formatTime(fill.time)}</TableCell>
                <TableCell className={`${c} font-medium`}>{fill.coin}</TableCell>
                <TableCell className={c}>
                  <SideLabel side={fill.side} />
                </TableCell>
                <TableCell className={cNum}>{formatPrice(px)}</TableCell>
                <TableCell className={cNum}>{fmtNum(sz)}</TableCell>
                <TableCell className={cNum}>{formatCompactUsd(tradeValue)}</TableCell>
                <TableCell className={cNum}>{formatCompactUsd(fee)}</TableCell>
                <TableCell className={cNum}>
                  {cpnl !== null ? (
                    <span className={cpnl >= 0 ? "text-gain" : "text-loss"}>
                      {formatCompactUsd(cpnl)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

/* ─── Order History (historical orders) ─── */

export function HistoryOrderTable({ histOrders, histLoading }: HistoryOrderTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>TIME</TableHead>
          <TableHead className={cHead}>TYPE</TableHead>
          <TableHead className={cHead}>COIN</TableHead>
          <TableHead className={cHead}>DIRECTION</TableHead>
          <TableHead className={cHeadNum}>SIZE</TableHead>
          <TableHead className={cHeadNum}>ORIGINAL SIZE</TableHead>
          <TableHead className={cHeadNum}>ORDER VALUE</TableHead>
          <TableHead className={cHeadNum}>PRICE</TableHead>
          <TableHead className={cHead}>REDUCE ONLY</TableHead>
          <TableHead className={cHead}>TRIGGER CONDITIONS</TableHead>
          <TableHead className={cHead}>TP/SL</TableHead>
          <TableHead className={cHead}>STATUS</TableHead>
          <TableHead className={cHeadNum}>ORDER ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {histLoading ? (
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
              <TableCell className={c}>
                <Skeleton className="h-3 w-14 rounded-sm" />
              </TableCell>
              <TableCell className={cNum}>
                <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
              </TableCell>
            </TableRow>
          ))
        ) : !histOrders || histOrders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={13} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                No order history
              </span>
            </TableCell>
          </TableRow>
        ) : (
          histOrders.map((entry, idx) => {
            const o = entry.order;
            const ot = getOrderType(o);
            const isTrigger = ot === "Stop Market" || ot === "Take Profit Market";
            const isFilled = entry.status === "filled";

            const remainingSz = Number(o.sz) || 0;
            const origSz = o.origSz ? Number(o.origSz) : remainingSz;
            const limitPx = Number(o.limitPx) || 0;

            const sizeDisplay = remainingSz === 0 ? "—" : fmtNum(remainingSz);
            const origSizeDisplay = isFilled ? fmtNum(origSz) : "—";

            let orderValueDisplay: string;
            if (isTrigger) {
              orderValueDisplay = "Market";
            } else if (remainingSz === 0) {
              orderValueDisplay = "—";
            } else {
              orderValueDisplay = formatOrderValue(o, remainingSz, limitPx);
            }

            const priceDisplay = isTrigger ? "Market" : formatPrice(limitPx);

            let triggerDisplay: string;
            if (isTrigger) {
              triggerDisplay = isFilled ? "Triggered" : getTriggerLabel(o);
            } else {
              triggerDisplay = "N/A";
            }

            return (
              <TableRow key={`${o.oid}-${idx}`} className="border-b border-border/30">
                <TableCell className={c}>{formatTime(entry.statusTimestamp)}</TableCell>
                <TableCell className={c}>{ot}</TableCell>
                <TableCell className={`${c} font-medium`}>{o.coin}</TableCell>
                <TableCell className={c}>
                  <DirLabel side={o.side} reduceOnly={o.reduceOnly} />
                </TableCell>
                <TableCell className={cNum}>{sizeDisplay}</TableCell>
                <TableCell className={cNum}>{origSizeDisplay}</TableCell>
                <TableCell className={cNum}>{orderValueDisplay}</TableCell>
                <TableCell className={cNum}>{priceDisplay}</TableCell>
                <TableCell className={c}>{o.reduceOnly ? "Yes" : "No"}</TableCell>
                <TableCell className={c}>{triggerDisplay}</TableCell>
                <TableCell className={c}>—</TableCell>
                <TableCell className={c}>{formatStatus(entry.status)}</TableCell>
                <TableCell className={cNum}>{o.oid}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
