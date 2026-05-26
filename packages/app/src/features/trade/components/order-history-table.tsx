import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import { formatPrice, formatCompactUsd } from "@/core/utils/formatters";
import { formatTime, fmtNum, formatStatus } from "./shared-table-utils";
import { SideLabel, DirLabel } from "./shared-table-components";
import { getOrderType, getTriggerLabel, formatOrderValue } from "../utils/trigger-utils";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "./orderbook-table-classes";
import type { UserFill, HistoricalOrderEntry } from "@0xsignal/shared";

/* ─── Styling constants ─── */

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/* ─── Types ─── */

interface TradeHistoryTableProps {
  fills?: UserFill[];
  isFillsLoading: boolean;
}

interface HistoryOrderTableProps {
  histOrders?: HistoricalOrderEntry[];
  isHistLoading: boolean;
}

/* ─── Trade History (fills) ─── */

export function TradeHistoryTable({ fills, isFillsLoading }: TradeHistoryTableProps) {
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
        {isFillsLoading ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                Loading...
              </span>
            </TableCell>
          </TableRow>
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
              <TableRow key={`${fill.hash}-${fill.time}`}>
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

export function HistoryOrderTable({ histOrders, isHistLoading }: HistoryOrderTableProps) {
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
        {isHistLoading ? (
          <TableRow>
            <TableCell colSpan={13} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                Loading...
              </span>
            </TableCell>
          </TableRow>
        ) : !histOrders || histOrders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={13} className="text-center py-6">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                No order history
              </span>
            </TableCell>
          </TableRow>
        ) : (
          histOrders.map((entry) => {
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
              <TableRow key={`${o.oid}-${entry.status}-${entry.statusTimestamp}`}>
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
