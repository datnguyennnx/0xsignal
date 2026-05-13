import { formatPrice } from "@/core/utils/formatters";
import type { OpenOrder } from "@0xsignal/shared";

/* ─── Nested extraction ─── */

/**
 * Extracts the trigger price from an order.
 * FrontendOpenOrderSchema: read from top-level `triggerPx`.
 * Legacy OpenOrderSchema: fallback to nested `orderType.trigger.triggerPx`.
 */
export function extractTriggerPx(order: OpenOrder): string | undefined {
  if (order.triggerPx) return order.triggerPx;
  // Legacy: check nested object format
  if (order.orderType && typeof order.orderType === "object") {
    const ot = order.orderType as Record<string, unknown>;
    if ("trigger" in ot) {
      const trigger = ot.trigger;
      if (trigger && typeof trigger === "object") {
        const t = trigger as Record<string, unknown>;
        if (typeof t.triggerPx === "string") return t.triggerPx;
        if (typeof t.triggerPx === "number") return String(t.triggerPx);
      }
    }
  }
  return undefined;
}

/**
 * Extracts the trigger condition ("above" / "below") from an order.
 * FrontendOpenOrderSchema: reads top-level `triggerCondition`.
 * Legacy: infers from order type + side.
 *
 * Inference mapping (user-specified):
 *   Buy (B)  + Stop Market       → "above"
 *   Buy (B)  + Take Profit Market → "below"
 *   Sell (A) + Stop Market        → "below"
 *   Sell (A) + Take Profit Market → "above"
 */
export function resolveTriggerCondition(order: OpenOrder): string | undefined {
  // FrontendOpenOrderSchema: triggerCondition may be "above", "below",
  // or the full string like "Price above 80250". Normalize to keyword only.
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

/* ─── Order type (Stop Market / Take Profit Market / Limit) ─── */

export function getOrderType(order: OpenOrder): string {
  // FrontendOpenOrderSchema: orderType is a native string
  if (typeof order.orderType === "string") {
    return order.orderType;
  }
  // Legacy: orderType is a nested object
  if (order.orderType && typeof order.orderType === "object") {
    if ("limit" in order.orderType) return "Limit";
    if ("trigger" in order.orderType) {
      if (order.triggerCondition) {
        const isAbove = order.triggerCondition.includes("above");
        if (order.side === "B" && isAbove) return "Stop Market";
        if (order.side === "B" && !isAbove) return "Take Profit Market";
        if (order.side === "A" && isAbove) return "Take Profit Market";
        if (order.side === "A" && !isAbove) return "Stop Market";
      }
      const trigger = (order.orderType as Record<string, unknown>).trigger;
      if (trigger && typeof trigger === "object") {
        const t = trigger as Record<string, unknown>;
        if (typeof t.triggerPx === "string" || typeof t.triggerPx === "number") {
          return "Stop Market";
        }
      }
      return "Stop Market";
    }
    if ("algo" in order.orderType) return "Algo";
    if ("ioc" in order.orderType) return "IOC";
  }
  return "Limit";
}

/* ─── Trigger label for TRIGGER CONDITIONS column ─── */

export function getTriggerLabel(order: OpenOrder): string {
  const ot = getOrderType(order);
  if (ot !== "Stop Market" && ot !== "Take Profit Market") return "—";

  const triggerPx = extractTriggerPx(order);
  if (!triggerPx) return "—";

  const condition = resolveTriggerCondition(order);
  if (!condition) return `Trigger ${formatPrice(Number(triggerPx))}`;

  return `Price ${condition} ${formatPrice(Number(triggerPx))}`;
}

/* ─── Order value display ─── */

/**
 * Returns "Market" for trigger orders, or the exact value formatted
 * with commas + " USDC" suffix for Limit orders.
 */
export function formatOrderValue(order: OpenOrder, sz: number, limitPx: number): string {
  const ot = getOrderType(order);
  if (ot === "Stop Market" || ot === "Take Profit Market") return "Market";
  const value = sz * limitPx;
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

/**
 * Returns "Market" for trigger orders, or formatPrice() for Limit orders.
 */
export function formatOrderPrice(order: OpenOrder, limitPx: number): string {
  const ot = getOrderType(order);
  if (ot === "Stop Market" || ot === "Take Profit Market") return "Market";
  return formatPrice(limitPx);
}
