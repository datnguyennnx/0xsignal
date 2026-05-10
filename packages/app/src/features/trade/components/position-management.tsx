import {
  useClearinghouseState,
  useOpenOrders,
  useUserFills,
  useHistoricalOrders,
} from "../hooks/use-user-positions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatPrice,
  formatSignedPercent,
  formatCompactUsd,
  formatSize,
} from "@/core/utils/formatters";
import type { OpenOrderSchema } from "@/services/api";

/* ─── Shared constants ─── */

const c = "px-2 py-1.5 text-xs";
const cNum = "px-2 py-1.5 text-xs text-right tabular-nums";
const cHead =
  "px-2 py-1.5 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider";
const cHeadNum =
  "px-2 py-1.5 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider text-right";

/* ─── Helpers ─── */

function TableSkeleton({ rows = 3, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: cols }).map((_, j) => (
              <TableCell key={j} className="py-1">
                <Skeleton className="h-3 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SideLabel({ side }: { side: "A" | "B" }) {
  return (
    <span className={side === "B" ? "text-gain" : "text-loss"}>
      {side === "B" ? "Long" : "Short"}
    </span>
  );
}

function DirLabel({ side, reduceOnly }: { side: "A" | "B"; reduceOnly?: boolean }) {
  if (reduceOnly) {
    return (
      <span className={side === "B" ? "text-gain" : "text-loss"}>
        {side === "B" ? "Close Short" : "Close Long"}
      </span>
    );
  }
  return (
    <span className={side === "B" ? "text-gain" : "text-loss"}>
      {side === "B" ? "Open Long" : "Open Short"}
    </span>
  );
}

function PosDirLabel({ szi }: { szi: string }) {
  const n = Number(szi);
  return <span className={n >= 0 ? "text-gain" : "text-loss"}>{n >= 0 ? "Long" : "Short"}</span>;
}

function PnLDisplay({ usd, pct }: { usd: number; pct: number }) {
  const isPositive = usd >= 0;
  return (
    <span className={isPositive ? "text-gain" : "text-loss"}>
      {formatCompactUsd(Math.abs(usd))} ({formatSignedPercent(pct)})
    </span>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function getOrderType(order: OpenOrderSchema): string {
  if (order.orderType && typeof order.orderType === "object") {
    if ("limit" in order.orderType) return "Limit";
    if ("trigger" in order.orderType) return "Stop Market";
    if ("algo" in order.orderType) return "Algo";
    if ("ioc" in order.orderType) return "IOC";
  }
  return "Limit";
}

function getTriggerLabel(order: OpenOrderSchema): string {
  if (order.isTrigger && order.triggerPx) {
    const direction = order.triggerCondition?.includes("above")
      ? "Price above"
      : order.triggerCondition?.includes("below")
        ? "Price below"
        : "Trigger";
    return `${direction} ${formatPrice(Number(order.triggerPx))}`;
  }
  if (order.triggerCondition) return order.triggerCondition;
  return "—";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

/* ─── Flat tab trigger ─── */

function TabTrigger({
  value,
  count,
  children,
}: {
  value: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative flex-none px-3 py-1.5 text-xs font-medium
        bg-transparent dark:bg-transparent border-0 rounded-none shadow-none
        data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent
        data-[state=active]:shadow-none
        text-muted-foreground hover:text-foreground/80
        data-[state=active]:text-foreground dark:data-[state=active]:text-foreground
        data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0
        data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-foreground
        transition-colors cursor-pointer"
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground font-normal">({count})</span>
      )}
    </TabsTrigger>
  );
}

/* ─── Main component ─── */

export function PositionManagement() {
  const { data: chData, isLoading: chLoading } = useClearinghouseState();
  const { data: openOrders, isLoading: ooLoading } = useOpenOrders();
  const { data: fills, isLoading: fillsLoading } = useUserFills();
  const { data: histOrders, isLoading: histLoading } = useHistoricalOrders();

  const positions = chData?.assetPositions ?? [];
  const marginSummary = chData?.marginSummary;
  const withdrawable = chData?.withdrawable;

  /* ─── Counts for tab badges ─── */
  const balanceCount = marginSummary ? 2 + positions.length : 0;
  const positionsCount = positions.length;
  const openOrdersCount = openOrders?.length ?? 0;

  /* ─── Aggregate PnL from all positions ─── */
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + Number(p.position.unrealizedPnl),
    0
  );

  return (
    <Tabs defaultValue="balance" className="h-full flex flex-col overflow-hidden">
      {/* Flat text tab triggers — no background box */}
      <TabsList className="shrink-0 flex gap-0 h-auto bg-transparent border-b border-border/40 rounded-none p-0">
        <TabTrigger value="balance" count={balanceCount}>
          Balance
        </TabTrigger>
        <TabTrigger value="positions" count={positionsCount}>
          Positions
        </TabTrigger>
        <TabTrigger value="open-orders" count={openOrdersCount}>
          Open Orders
        </TabTrigger>
        <TabTrigger value="trade-history">Trade History</TabTrigger>
        <TabTrigger value="order-history">Order History</TabTrigger>
      </TabsList>

      {/* ════════════════ BALANCE ════════════════ */}
      <TabsContent
        value="balance"
        className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        {chLoading ? (
          <TableSkeleton rows={3} cols={9} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cHead}>Coin</TableHead>
                <TableHead className={cHeadNum}>Total Balance</TableHead>
                <TableHead className={cHeadNum}>Available Balance</TableHead>
                <TableHead className={cHeadNum}>USDC Value</TableHead>
                <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
                <TableHead className={cHead}>Send</TableHead>
                <TableHead className={cHead}>Transfer</TableHead>
                <TableHead className={cHead}>Repay</TableHead>
                <TableHead className={cHead}>Contract</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marginSummary ? (
                <>
                  {/* USDC row */}
                  <TableRow className="border-b border-border/30">
                    <TableCell className={`${c} font-medium`}>USDC</TableCell>
                    <TableCell className={cNum}>
                      {fmtNum(Number(marginSummary.totalRawUsd))} USDC
                    </TableCell>
                    <TableCell className={cNum}>{fmtNum(Number(withdrawable ?? 0))} USDC</TableCell>
                    <TableCell className={cNum}>
                      {formatCompactUsd(Number(marginSummary.totalRawUsd))}
                    </TableCell>
                    <TableCell className={cNum}>
                      {totalUnrealizedPnl !== 0 ? (
                        <span className={totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss"}>
                          {formatCompactUsd(Math.abs(totalUnrealizedPnl))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                  </TableRow>

                  {/* Cross Margin row */}
                  <TableRow className="border-b border-border/30">
                    <TableCell className={`${c} font-medium`}>Cross Margin</TableCell>
                    <TableCell className={cNum}>
                      {formatCompactUsd(Number(marginSummary.accountValue))}
                    </TableCell>
                    <TableCell className={cNum}>
                      {formatCompactUsd(Number(withdrawable ?? 0))}
                    </TableCell>
                    <TableCell className={cNum}>
                      {formatCompactUsd(Number(marginSummary.accountValue))}
                    </TableCell>
                    <TableCell className={cNum}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                    <TableCell className={c}>—</TableCell>
                  </TableRow>

                  {/* Per-position rows */}
                  {positions.map(({ position }) => {
                    const posValue = Number(position.positionValue);
                    const upnl = Number(position.unrealizedPnl);
                    const roe = Number(position.returnOnEquity);
                    return (
                      <TableRow key={position.coin} className="border-b border-border/30">
                        <TableCell className={`${c} font-medium`}>{position.coin}</TableCell>
                        <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                        <TableCell className={cNum}>—</TableCell>
                        <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
                        <TableCell className={cNum}>
                          {upnl !== 0 ? <PnLDisplay usd={upnl} pct={roe} /> : "—"}
                        </TableCell>
                        <TableCell className={c}>—</TableCell>
                        <TableCell className={c}>—</TableCell>
                        <TableCell className={c}>—</TableCell>
                        <TableCell className={c}>—</TableCell>
                      </TableRow>
                    );
                  })}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-4 text-xs">
                    No balance data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* ════════════════ POSITIONS ════════════════ */}
      <TabsContent
        value="positions"
        className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        {chLoading ? (
          <TableSkeleton cols={11} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cHead}>Coin</TableHead>
                <TableHead className={cHeadNum}>Size</TableHead>
                <TableHead className={cHeadNum}>Position Value</TableHead>
                <TableHead className={cHeadNum}>Entry Price</TableHead>
                <TableHead className={cHeadNum}>Mark Price</TableHead>
                <TableHead className={cHeadNum}>PNL (ROE %)</TableHead>
                <TableHead className={cHeadNum}>Liq. Price</TableHead>
                <TableHead className={cHeadNum}>Margin</TableHead>
                <TableHead className={cHeadNum}>Funding</TableHead>
                <TableHead className={cHead}>Close All</TableHead>
                <TableHead className={cHead}>TP/SL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length > 0 ? (
                positions.map(({ position }) => {
                  const signedSz = Number(position.szi);
                  const sz = Math.abs(signedSz);
                  const entryPx = Number(position.entryPx);
                  const posValue = Number(position.positionValue);
                  const liqPx = Number(position.liquidationPx);
                  const marginUsed = Number(position.marginUsed);
                  const unrealizedPnl = Number(position.unrealizedPnl);
                  const roe = Number(position.returnOnEquity);
                  const cumFunding = Number(position.cumFunding.sinceOpen);
                  const markPx = signedSz !== 0 ? entryPx + unrealizedPnl / signedSz : entryPx;

                  return (
                    <TableRow key={position.coin} className="border-b border-border/30">
                      <TableCell className={`${c} font-medium`}>
                        <span className="flex items-center gap-1.5">
                          {position.coin}
                          <PosDirLabel szi={position.szi} />
                        </span>
                      </TableCell>
                      <TableCell className={cNum}>{formatSize(sz)}</TableCell>
                      <TableCell className={cNum}>{formatCompactUsd(posValue)}</TableCell>
                      <TableCell className={cNum}>{formatPrice(entryPx)}</TableCell>
                      <TableCell className={cNum}>{formatPrice(markPx)}</TableCell>
                      <TableCell className={cNum}>
                        <PnLDisplay usd={unrealizedPnl} pct={roe} />
                      </TableCell>
                      <TableCell className={cNum}>{liqPx > 0 ? formatPrice(liqPx) : "—"}</TableCell>
                      <TableCell className={cNum}>{formatCompactUsd(marginUsed)}</TableCell>
                      <TableCell
                        className={`${cNum} ${cumFunding >= 0 ? "text-gain" : "text-loss"}`}
                      >
                        {formatCompactUsd(Math.abs(cumFunding))}
                      </TableCell>
                      <TableCell className={c}>—</TableCell>
                      <TableCell className={c}>—</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground py-4 text-xs"
                  >
                    No open positions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* ════════════════ OPEN ORDERS ════════════════ */}
      <TabsContent
        value="open-orders"
        className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        {ooLoading ? (
          <TableSkeleton cols={12} />
        ) : (
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
                <TableHead className={cHead}>Cancel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openOrders && openOrders.length > 0 ? (
                openOrders.map((order) => {
                  const sz = Number(order.sz);
                  const origSz = order.origSz ? Number(order.origSz) : sz;
                  const limitPx = Number(order.limitPx);
                  const orderValue = sz * limitPx;
                  return (
                    <TableRow key={order.oid} className="border-b border-border/30">
                      <TableCell className={c}>{formatTime(order.timestamp)}</TableCell>
                      <TableCell className={c}>{getOrderType(order)}</TableCell>
                      <TableCell className={`${c} font-medium`}>{order.coin}</TableCell>
                      <TableCell className={c}>
                        <DirLabel side={order.side} reduceOnly={order.reduceOnly} />
                      </TableCell>
                      <TableCell className={cNum}>{fmtNum(sz)}</TableCell>
                      <TableCell className={cNum}>{origSz !== sz ? fmtNum(origSz) : "—"}</TableCell>
                      <TableCell className={cNum}>{formatCompactUsd(orderValue)}</TableCell>
                      <TableCell className={cNum}>{formatPrice(limitPx)}</TableCell>
                      <TableCell className={c}>
                        {order.reduceOnly ? <span className="text-gain">Yes</span> : "No"}
                      </TableCell>
                      <TableCell className={c}>{getTriggerLabel(order)}</TableCell>
                      <TableCell className={c}>—</TableCell>
                      <TableCell className={c}>
                        <span className="text-muted-foreground cursor-not-allowed">Cancel</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground py-4 text-xs"
                  >
                    No open orders yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* ════════════════ TRADE HISTORY (fills) ════════════════ */}
      <TabsContent
        value="trade-history"
        className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        {fillsLoading ? (
          <TableSkeleton cols={8} />
        ) : (
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
              {fills && fills.length > 0 ? (
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
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4 text-xs">
                    No trade history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      {/* ════════════════ ORDER HISTORY (historical orders) ════════════════ */}
      <TabsContent
        value="order-history"
        className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
      >
        {histLoading ? (
          <TableSkeleton cols={13} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cHead}>Time</TableHead>
                <TableHead className={cHead}>Type</TableHead>
                <TableHead className={cHead}>Coin</TableHead>
                <TableHead className={cHead}>Direction</TableHead>
                <TableHead className={cHeadNum}>Size</TableHead>
                <TableHead className={cHeadNum}>Filled Size</TableHead>
                <TableHead className={cHeadNum}>Order Value</TableHead>
                <TableHead className={cHeadNum}>Price</TableHead>
                <TableHead className={cHead}>Reduce Only</TableHead>
                <TableHead className={cHead}>Trigger Conditions</TableHead>
                <TableHead className={cHead}>TP/SL</TableHead>
                <TableHead className={cHead}>Status</TableHead>
                <TableHead className={cHeadNum}>Order ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {histOrders && histOrders.length > 0 ? (
                histOrders.map((entry, idx) => {
                  const o = entry.order as OpenOrderSchema & {
                    origSz?: string;
                    triggerCondition?: string;
                    triggerPx?: string;
                    isTrigger?: boolean;
                    reduceOnly?: boolean;
                  };
                  const sz = o.sz ? Number(o.sz) : 0;
                  const origSz = o.origSz ? Number(o.origSz) : sz;
                  const filledSz = origSz - sz;
                  const limitPx = o.limitPx ? Number(o.limitPx) : 0;
                  const orderValue = sz * limitPx;
                  return (
                    <TableRow key={`${o.oid}-${idx}`} className="border-b border-border/30">
                      <TableCell className={c}>{formatTime(entry.statusTimestamp)}</TableCell>
                      <TableCell className={c}>{getOrderType(o)}</TableCell>
                      <TableCell className={`${c} font-medium`}>{o.coin}</TableCell>
                      <TableCell className={c}>
                        <DirLabel side={o.side} reduceOnly={o.reduceOnly} />
                      </TableCell>
                      <TableCell className={cNum}>{fmtNum(sz)}</TableCell>
                      <TableCell className={cNum}>
                        {filledSz > 0 ? fmtNum(filledSz) : "—"}
                      </TableCell>
                      <TableCell className={cNum}>{formatCompactUsd(orderValue)}</TableCell>
                      <TableCell className={cNum}>{formatPrice(limitPx)}</TableCell>
                      <TableCell className={c}>
                        {o.reduceOnly ? <span className="text-gain">Yes</span> : "No"}
                      </TableCell>
                      <TableCell className={c}>
                        {"isTrigger" in o && o.isTrigger && o.triggerPx ? getTriggerLabel(o) : "—"}
                      </TableCell>
                      <TableCell className={c}>—</TableCell>
                      <TableCell className={c}>
                        <span
                          className={
                            entry.status === "filled" ? "text-gain" : "text-muted-foreground"
                          }
                        >
                          {entry.status === "filled"
                            ? "Filled"
                            : entry.status === "canceled"
                              ? "Canceled"
                              : entry.status}
                        </span>
                      </TableCell>
                      <TableCell className={cNum}>{o.oid}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={13}
                    className="text-center text-muted-foreground py-4 text-xs"
                  >
                    No order history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  );
}
