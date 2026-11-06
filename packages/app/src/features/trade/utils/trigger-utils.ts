import { formatCompactUsd, formatPrice } from "@/core/utils/formatters";
import type { OpenOrder, FrontendOpenOrder } from "@0xsignal/shared";

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One wire-to-number boundary for every trigger field. */
function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Wire `orderType` discriminants. `trigger` is resolved to Stop/TP by condition;
 * the rest pass through. An object with no known key is a contract breach.
 */
const OBJECT_ORDER_TYPES = [
  ["limit", "Limit"],
  ["trigger", "Trigger"],
  ["algo", "Algo"],
  ["ioc", "IOC"],
] as const;

function primitiveOrderType(order: OpenOrder): string {
  if (typeof order.orderType === "string") return order.orderType;
  const ot = order.orderType;
  if (!isNonNullObject(ot)) {
    throw new Error(`Unknown order type: ${JSON.stringify(order.orderType)}`);
  }
  for (const [key, label] of OBJECT_ORDER_TYPES) {
    if (key in ot) return label;
  }
  throw new Error(`Unknown order type: ${Object.keys(ot).join(", ")}`);
}

/** Extract trigger price from order. */
export function extractTriggerPx(order: OpenOrder): string | undefined {
  if (order.triggerPx !== undefined && order.triggerPx !== "") return order.triggerPx;
  const ot = order.orderType;
  if (!isNonNullObject(ot) || !("trigger" in ot)) return undefined;
  const trigger = ot.trigger;
  if (!isNonNullObject(trigger) || trigger.triggerPx === undefined) return undefined;
  const px = toNumber(trigger.triggerPx);
  return px > 0 ? String(px) : undefined;
}

/**
 * Extract trigger condition ("above"/"below") from order.
 * Checks top-level triggerPx first, then infers from order type + side.
 */
export function resolveTriggerCondition(order: OpenOrder): string | undefined {
  if (order.triggerCondition !== undefined && order.triggerCondition !== "") {
    const tc = order.triggerCondition.toLowerCase();
    if (tc.includes("above")) return "above";
    if (tc.includes("below")) return "below";
    return order.triggerCondition;
  }

  const ot = primitiveOrderType(order);
  if (ot === "Stop Market" || ot === "Trigger") {
    return order.side === "B" ? "above" : "below";
  }
  if (ot === "Take Profit Market") {
    return order.side === "B" ? "below" : "above";
  }

  return undefined;
}

export function getOrderType(order: OpenOrder): string {
  const base = primitiveOrderType(order);
  if (base !== "Trigger") return base;

  const condition = resolveTriggerCondition(order);
  if (condition === "above") {
    return order.side === "B" ? "Stop Market" : "Take Profit Market";
  }
  if (condition === "below") {
    return order.side === "B" ? "Take Profit Market" : "Stop Market";
  }
  return "Stop Market";
}

export function getTriggerLabel(order: OpenOrder): string {
  const ot = getOrderType(order);
  if (ot !== "Stop Market" && ot !== "Take Profit Market") return "—";

  const triggerPx = extractTriggerPx(order);
  if (triggerPx === undefined || triggerPx === "") return "—";

  const condition = resolveTriggerCondition(order);
  if (condition === undefined || condition === "")
    return `Trigger ${formatPrice(toNumber(triggerPx))}`;

  return `Price ${condition} ${formatPrice(toNumber(triggerPx))}`;
}

/** "Market" for trigger orders, or canonical currency for Limit. */
export function formatOrderValue(order: OpenOrder, sz: number, limitPx: number): string {
  const ot = getOrderType(order);
  if (ot === "Stop Market" || ot === "Take Profit Market") return "Market";
  return formatCompactUsd(sz * limitPx);
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
      const limitVal = toNumber(child.limitPx);
      const triggerVal = toNumber(child.triggerPx);
      const priceNum = limitVal > 0 ? limitVal : Math.max(triggerVal, 0);
      const px = formatPrice(priceNum);
      if (ot.includes("Take Profit")) tp = px;
      else if (ot.includes("Stop")) sl = px;
    }
    if (tp !== null || sl !== null) {
      map[order.coin.toUpperCase()] = { tp, sl };
    }
  }
  return map;
}
