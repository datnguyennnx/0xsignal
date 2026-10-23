import { useCallback } from "react";
import { toast } from "sonner";
import type { PlaceOrderRequest } from "@/services/api";
import type { PlaceOrderEntry } from "@0xsignal/shared";
import { usePlaceOrder } from "./use-place-order";
import { formatOrderSize } from "../utils/trade-math";
import { UnauthenticatedError } from "@/lib/api-base";
import { useAppStore } from "@/stores/use-app-store";

interface UseOrderFormSubmitParams {
  symbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  price: string;
  size: string;
  usablePrice: number;
  szDecimals: number;
  reduceOnly: boolean;
  showTpSl: boolean;
  tpPrice: string;
  slPrice: string;
  onPriceInvalid: () => void;
}

export function useOrderFormSubmit({
  symbol,
  side,
  orderType,
  price,
  size,
  usablePrice,
  szDecimals,
  reduceOnly,
  showTpSl,
  tpPrice,
  slPrice,
  onPriceInvalid,
}: UseOrderFormSubmitParams) {
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("trade-order-form");
  }, []);

  const handlePlaceOrderError = useCallback(
    (err: Error) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
      }
    },
    [openConnectWallet],
  );
  const placeOrderMutation = usePlaceOrder(handlePlaceOrderError);

  const handlePlaceOrder = () => {
    if (orderType === "limit" && (!price || Number(price) <= 0)) {
      onPriceInvalid();
      toast.error("Enter a price greater than 0.");
      return;
    }

    const effectiveEntryPrice = usablePrice;
    if (effectiveEntryPrice <= 0 || !Number(size) || Number(size) <= 0) return;

    const rawSz = Number(size) / effectiveEntryPrice;
    const formattedSz = formatOrderSize(rawSz, szDecimals);
    if (formattedSz === "0") return;

    const orders: PlaceOrderRequest["orders"] = [];

    const orderTypeConfig: PlaceOrderEntry["orderType"] =
      orderType === "market"
        ? { kind: "limit", timeInForce: "FrontendMarket" }
        : { kind: "limit", timeInForce: "GTC" };

    orders.push({
      symbol,
      side,
      quantity: formattedSz,
      price: orderType === "market" ? String(effectiveEntryPrice) : price,
      reduceOnly,
      orderType: orderTypeConfig,
    });

    if (showTpSl && tpPrice) {
      orders.push({
        symbol,
        side: side === "buy" ? "sell" : "buy",
        quantity: formattedSz,
        price: tpPrice,
        reduceOnly: true,
        orderType: { kind: "trigger", isMarket: true, triggerPrice: tpPrice, tpsl: "tp" },
      });
    }

    if (showTpSl && slPrice) {
      orders.push({
        symbol,
        side: side === "buy" ? "sell" : "buy",
        quantity: formattedSz,
        price: slPrice,
        reduceOnly: true,
        orderType: { kind: "trigger", isMarket: true, triggerPrice: slPrice, tpsl: "sl" },
      });
    }

    const payload: PlaceOrderRequest = {
      orders,
      ...(showTpSl && tpPrice && slPrice ? { grouping: "normalTpsl" as const } : {}),
    };

    placeOrderMutation.mutate(payload);
  };

  return { handlePlaceOrder, isPending: placeOrderMutation.isPending };
}
