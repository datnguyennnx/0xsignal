import type { FrontendOpenOrder, OpenOrder } from "@0xsignal/shared";

export interface OpenOrderRowProps {
  order: OpenOrder;
  readOnly: boolean;
  isCancelPending: boolean;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: FrontendOpenOrder) => void;
}

/** Child TP/SL orders only exist on the enriched own-account read. */
export function isFrontendOpenOrder(order: OpenOrder): order is FrontendOpenOrder {
  return "children" in order && Array.isArray(order.children);
}

/** Order type is normally a wire string, but some reads send a discriminant object. */
const sameOrderType = (a: OpenOrder["orderType"], b: OpenOrder["orderType"]): boolean => {
  if (a === b) return true;
  return typeof a === "string" && typeof b === "string" && a === b;
};

/** The row prints only whether children exist, but `View` hands the current order onward. */
const childrenSignature = (order: OpenOrder): string => {
  if (!isFrontendOpenOrder(order)) return "";
  return order.children
    .map((child) =>
      [
        child.oid,
        child.coin,
        child.side,
        child.sz,
        child.origSz,
        child.limitPx,
        child.triggerPx,
        child.triggerCondition,
        child.reduceOnly,
        typeof child.orderType === "string" ? child.orderType : JSON.stringify(child.orderType),
      ].join("|"),
    )
    .join(";");
};

/**
 * A stream frame hands every row a fresh order object. Compare the scalars the
 * row prints (plus its controls) so unchanged rows skip the re-render.
 */
export function areOpenOrderRowPropsEqual(
  prev: OpenOrderRowProps,
  next: OpenOrderRowProps,
): boolean {
  if (
    prev.readOnly !== next.readOnly ||
    prev.isCancelPending !== next.isCancelPending ||
    prev.onCancelOrder !== next.onCancelOrder ||
    prev.onViewTpSl !== next.onViewTpSl
  ) {
    return false;
  }

  const a = prev.order;
  const b = next.order;
  return (
    a.oid === b.oid &&
    a.coin === b.coin &&
    a.side === b.side &&
    a.sz === b.sz &&
    a.origSz === b.origSz &&
    a.limitPx === b.limitPx &&
    a.timestamp === b.timestamp &&
    a.reduceOnly === b.reduceOnly &&
    a.triggerPx === b.triggerPx &&
    a.triggerCondition === b.triggerCondition &&
    a.isTrigger === b.isTrigger &&
    sameOrderType(a.orderType, b.orderType) &&
    childrenSignature(a) === childrenSignature(b)
  );
}
