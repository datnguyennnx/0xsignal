import { memo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import { formatTime, formatStatus } from "../utils/shared-table-utils";
import {
  DirLabel,
  DirDisplay,
  FillHistoryTableHeader,
  TableEmptyRow,
  resolveTableState,
} from "./shared-table-components";
import { getOrderType, getTriggerLabel, formatOrderValue } from "../utils/trigger-utils";
import { c, cNum, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import type { UserFill, HistoricalOrderEntry } from "@0xsignal/shared";

interface TradeHistoryTableProps {
  fills?: UserFill[];
  isFillsLoading: boolean;
  isFillsError?: boolean;
  onRetry?: (() => void) | undefined;
}

interface HistoryOrderTableProps {
  histOrders?: HistoricalOrderEntry[];
  isHistLoading: boolean;
  isHistError?: boolean;
  onRetry?: (() => void) | undefined;
}

/* Trade History (fills) */

export const TradeHistoryTable = memo(function TradeHistoryTable({
  fills,
  isFillsLoading,
  isFillsError = false,
  onRetry,
}: TradeHistoryTableProps) {
  const seenFills = new Map<string, number>();
  const state = resolveTableState({ isLoading: isFillsLoading, isError: isFillsError });
  return (
    <Table className="table-cull">
      <FillHistoryTableHeader />
      <TableBody>
        {state === "empty" ? (
          !fills || fills.length === 0 ? (
            <TableEmptyRow colSpan={8} />
          ) : (
            fills.map((fill) => {
              const sz = Number(fill.sz);
              const px = Number(fill.px);
              const tradeValue = sz * px;
              const fee = Number(fill.fee);
              const cpnl =
                fill.closedPnl !== undefined && fill.closedPnl !== ""
                  ? Number(fill.closedPnl)
                  : null;
              const fillKey = `${fill.hash}-${fill.time}`;
              const occurrence = (seenFills.get(fillKey) ?? 0) + 1;
              seenFills.set(fillKey, occurrence);
              return (
                <TableRow key={`${fillKey}#${occurrence}`}>
                  <TableCell className={c}>{formatTime(fill.time)}</TableCell>
                  <TableCell className={`${c} font-medium`}>{fill.coin}</TableCell>
                  <TableCell className={c}>
                    <DirDisplay dir={fill.dir} />
                  </TableCell>
                  <TableCell className={cNum}>{formatPrice(px)}</TableCell>
                  <TableCell className={cNum}>{formatSize(sz)}</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(tradeValue)}</TableCell>
                  <TableCell className={cNum}>{formatCompactUsd(fee)}</TableCell>
                  <TableCell className={cNum}>
                    {cpnl === null ? (
                      "—"
                    ) : (
                      <span className={cpnl >= 0 ? "text-gain" : "text-loss"}>
                        {formatCompactUsd(cpnl)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )
        ) : (
          <TableEmptyRow
            colSpan={8}
            state={state}
            onRetry={onRetry}
            errorTitle="Couldn't load trade history"
            errorDescription="The fills request failed. Check your connection and try again."
          />
        )}
      </TableBody>
    </Table>
  );
});

/* Order History (historical orders) */

export const HistoryOrderTable = memo(function HistoryOrderTable({
  histOrders,
  isHistLoading,
  isHistError = false,
  onRetry,
}: HistoryOrderTableProps) {
  const state = resolveTableState({ isLoading: isHistLoading, isError: isHistError });
  return (
    <Table className="table-cull">
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Type</TableHead>
          <TableHead className={`${cHead} font-medium`}>Coin</TableHead>
          <TableHead className={cHead}>Direction</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Filled Size</TableHead>
          <TableHead className={cHeadNum}>Order Value</TableHead>
          <TableHead className={cHeadNum}>Price</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Trigger</TableHead>
          <TableHead className={cHead}>TP/SL</TableHead>
          <TableHead className={cHead}>Status</TableHead>
          <TableHead className={cHeadNum}>Order ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {state === "empty" ? (
          !histOrders || histOrders.length === 0 ? (
            <TableEmptyRow colSpan={13} />
          ) : (
            histOrders.map((entry) => {
              const o = entry.order;
              const ot = getOrderType(o);
              const isTrigger = ot === "Stop Market" || ot === "Take Profit Market";
              const isFilled = entry.status === "filled";

              const remainingSz = Number(o.sz) || 0;
              const origSz =
                o.origSz !== undefined && o.origSz !== "" ? Number(o.origSz) : remainingSz;
              const limitPx = Number(o.limitPx) || 0;

              const sizeDisplay = remainingSz === 0 ? "—" : formatSize(remainingSz);
              const origSizeDisplay = isFilled ? formatSize(origSz) : "—";

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
                    {o.dir !== undefined && o.dir !== "" ? (
                      <DirDisplay dir={o.dir} />
                    ) : (
                      <DirLabel side={o.side} reduceOnly={o.reduceOnly} />
                    )}
                  </TableCell>
                  <TableCell className={cNum}>{sizeDisplay}</TableCell>
                  <TableCell className={cNum}>{origSizeDisplay}</TableCell>
                  <TableCell className={cNum}>{orderValueDisplay}</TableCell>
                  <TableCell className={cNum}>{priceDisplay}</TableCell>
                  <TableCell className={c}>{o.reduceOnly === true ? "Yes" : "No"}</TableCell>
                  <TableCell className={c}>{triggerDisplay}</TableCell>
                  <TableCell className={c}>—</TableCell>
                  <TableCell className={c}>{formatStatus(entry.status)}</TableCell>
                  <TableCell className={cNum}>{o.oid}</TableCell>
                </TableRow>
              );
            })
          )
        ) : (
          <TableEmptyRow
            colSpan={13}
            state={state}
            onRetry={onRetry}
            errorTitle="Couldn't load order history"
            errorDescription="The historical-orders request failed. Check your connection and try again."
          />
        )}
      </TableBody>
    </Table>
  );
});
