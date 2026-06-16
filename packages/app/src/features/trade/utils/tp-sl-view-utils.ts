import { formatPrice } from "@/core/utils/formatters";
import type { OpenOrder } from "@0xsignal/shared";
import { getOrderType, extractTriggerPx, resolveTriggerCondition } from "./trigger-utils";

export interface TpSlOrderDisplay {
  label: string;
  type: string;
  side: "A" | "B";
  sz: string;
  trigger: string;
  price: string;
  isMarket?: boolean;
}

export function toTpSlDisplay(order: OpenOrder): TpSlOrderDisplay {
  const ot = getOrderType(order);
  const isTrigger = ot === "Stop Market" || ot === "Take Profit Market";
  const triggerPx = extractTriggerPx(order);

  let triggerLabel = "N/A";
  if (isTrigger && triggerPx) {
    const condition = resolveTriggerCondition(order);
    const formattedPx = formatPrice(Number(triggerPx));
    triggerLabel = condition ? `${condition} ${formattedPx}` : `Trigger ${formattedPx}`;
  }

  const priceLabel = isTrigger ? "Market" : formatPrice(Number(order.limitPx));

  return {
    label: order.coin,
    type: ot,
    side: order.side,
    sz: order.sz,
    trigger: triggerLabel,
    price: priceLabel,
    isMarket: isTrigger,
  };
}
