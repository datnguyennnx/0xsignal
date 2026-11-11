import type { OpenOrder } from "@0xsignal/shared";

export interface OpenOrderRowProps {
  order: OpenOrder;
  readOnly: boolean;
  isCancelPending: boolean;
  onCancelOrder: (coin: string, oid: number) => void;
  onViewTpSl: (order: OpenOrder) => void;
}

export function isPositionTpSlOrder(order: OpenOrder): boolean {
  return order.isPositionTpsl === true && order.isTrigger === true;
}

/** Order type is normally a wire string, but some reads send a discriminant object. */
const sameOrderType = (a: OpenOrder["orderType"], b: OpenOrder["orderType"]): boolean => a === b;

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
    a.isPositionTpsl === b.isPositionTpsl &&
    sameOrderType(a.orderType, b.orderType)
  );
}
