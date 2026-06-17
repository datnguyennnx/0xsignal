import { formatPrice } from "@/core/utils/formatters";
import type { OpenOrder, FrontendOpenOrder } from "@0xsignal/shared";

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extract trigger price from order (top-level, with legacy nested fallback). */
export function extractTriggerPx(order: OpenOrder): string | undefined {
  if (order.triggerPx) return order.triggerPx;
  const ot = order.orderType;
  if (isNonNullObject(ot) && "trigger" in ot) {
    const trigger = ot.trigger;
    if (isNonNullObject(trigger) && typeof trigger.triggerPx === "string") return trigger.triggerPx;
    if (isNonNullObject(trigger) && typeof trigger.triggerPx === "number")
      return String(trigger.triggerPx);
  }
  return undefined;
}

/**
 * Extract trigger condition ("above"/"below") from order.
 * Top-level with legacy inference fallback.
 */
export function resolveTriggerCondition(order: OpenOrder): string | undefined {
  if (order.triggerCondition) {
    const tc = order.triggerCondition.toLowerCase();
    if (tc.includes("above")) return "above";
    if (tc.includes("below")) return "below";
    return order.triggerCondition;
  }

  // Legacy: infer from order type + side
  const ot = getOrderType(order);
  if (ot === "Stop Market") return order.side === "B" ? "above" : "below";
  if (ot === "Take Profit Market") return order.side === "B" ? "below" : "above";

  return undefined;
}

export function getOrderType(order: OpenOrder): string {
  // FrontendOpenOrderSchema: orderType is a native string
  if (typeof order.orderType === "string") {
    return order.orderType;
  }
  // Legacy: orderType is a nested object
  const ot = order.orderType;
  if (isNonNullObject(ot)) {
    if ("limit" in ot) return "Limit";
    if ("trigger" in ot) {
      if (order.triggerCondition) {
        const isAbove = order.triggerCondition.includes("above");
        if (order.side === "B" && isAbove) return "Stop Market";
        if (order.side === "B" && !isAbove) return "Take Profit Market";
        if (order.side === "A" && isAbove) return "Take Profit Market";
        if (order.side === "A" && !isAbove) return "Stop Market";
      }
      const trigger = ot.trigger;
      if (
        isNonNullObject(trigger) &&
        (typeof trigger.triggerPx === "string" || typeof trigger.triggerPx === "number")
      ) {
        return "Stop Market";
      }
      return "Stop Market";
    }
    if ("algo" in ot) return "Algo";
    if ("ioc" in ot) return "IOC";
  }
  return "Limit";
}

export function getTriggerLabel(order: OpenOrder): string {
  const ot = getOrderType(order);
  if (ot !== "Stop Market" && ot !== "Take Profit Market") return "—";

  const triggerPx = extractTriggerPx(order);
  if (!triggerPx) return "—";

  const condition = resolveTriggerCondition(order);
  if (!condition) return `Trigger ${formatPrice(Number(triggerPx))}`;

  return `Price ${condition} ${formatPrice(Number(triggerPx))}`;
}

/** "Market" for trigger orders, formatted with commas + " USDC" suffix for Limit. */
export function formatOrderValue(order: OpenOrder, sz: number, limitPx: number): string {
  const ot = getOrderType(order);
  if (ot === "Stop Market" || ot === "Take Profit Market") return "Market";
  const value = sz * limitPx;
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

/** "Market" for trigger orders, or formatPrice() for Limit. */
export function formatOrderPrice(order: OpenOrder, limitPx: number): string {
  const ot = getOrderType(order);
  if (ot === "Stop Market" || ot === "Take Profit Market") return "Market";
  return formatPrice(limitPx);
}

/**
 * Build a coin→{tp, sl} map from open orders.
 * Iterates each order's children, parses TP/SL trigger orders,
 * and maps them to the parent coin.
 */
export function buildTpSlByCoinMap(
  openOrders: readonly FrontendOpenOrder[] | undefined,
): Record<string, { tp: string | null; sl: string | null }> {
  if (!openOrders) return {};
  const map: Record<string, { tp: string | null; sl: string | null }> = {};
  for (const order of openOrders) {
    if (!order.children?.length) continue;
    let tp: string | null = null;
    let sl: string | null = null;
    for (const child of order.children) {
      const ot = getOrderType(child);
      const limitVal = Number(child.limitPx);
      const triggerVal = Number(child.triggerPx);
      const priceNum = limitVal > 0 ? limitVal : triggerVal > 0 ? triggerVal : 0;
      const px = formatPrice(priceNum);
      if (ot.includes("Take Profit")) tp = px;
      else if (ot.includes("Stop")) sl = px;
    }
    if (tp || sl) {
      map[order.coin.toUpperCase()] = { tp, sl };
    }
  }
  return map;
}
