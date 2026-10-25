import { useCallback } from "react";
import { useOpenOrders } from "./use-user-data";
import { useCancelOrdersMutation } from "./use-cancel-orders-mutation";
import { usePlaceOrder } from "./use-place-order";
import { useHyperliquidMeta } from "./use-hyperliquid-meta";
import { formatOrderSize } from "../utils/trade-math";
import { UnauthenticatedError } from "@/lib/api-base";
import { useAppStore } from "@/stores/use-app-store";
import { toast } from "sonner";

interface UsePositionActionsParams {
  signingDisabled: boolean;
}

export function usePositionActions({ signingDisabled }: UsePositionActionsParams) {
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("trade-position-management");
  }, []);

  const { data: openOrders } = useOpenOrders(!signingDisabled);
  const cancelOrdersMutation = useCancelOrdersMutation();
  const { getPrecision } = useHyperliquidMeta();

  const handlePlaceOrderError = useCallback(
    (err: Error) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
        return;
      }
      toast.error(err.message);
    },
    [openConnectWallet],
  );
  const placeOrderMutation = usePlaceOrder(handlePlaceOrderError);

  const handleCancelOrder = useCallback(
    (coin: string, oid: number) => {
      if (signingDisabled) return;
      cancelOrdersMutation.mutate(
        { cancels: [{ symbol: coin, orderId: oid }] },
        {
          onError: (err) => {
            if (err instanceof UnauthenticatedError) {
              openConnectWallet();
            }
          },
        },
      );
    },
    [cancelOrdersMutation, openConnectWallet, signingDisabled],
  );

  const handleCancelAllConfirm = () => {
    if (signingDisabled) return false;
    if (!openOrders || openOrders.length === 0) return false;
    const cancels = openOrders.map((o) => ({ symbol: o.coin, orderId: o.oid }));
    cancelOrdersMutation.mutate(
      { cancels },
      {
        onError: (err) => {
          if (err instanceof UnauthenticatedError) {
            openConnectWallet();
          }
        },
      },
    );
    return true;
  };

  const handleCloseMarket = useCallback(
    (coin: string, size: string, isLong: boolean) => {
      if (signingDisabled) return;
      const { szDecimals } = getPrecision(coin);
      const absSz = Math.abs(Number(size));
      const formattedSz = formatOrderSize(absSz, szDecimals);
      placeOrderMutation.mutate({
        orders: [
          {
            symbol: coin,
            side: isLong ? "sell" : "buy",
            quantity: formattedSz,
            price: "0",
            reduceOnly: true,
            orderType: { kind: "limit", timeInForce: "FrontendMarket" },
          },
        ],
        grouping: "na",
      });
    },
    [getPrecision, placeOrderMutation, signingDisabled],
  );

  const submitCloseLimit = useCallback(
    ({
      coin,
      isLong,
      price,
      size,
    }: {
      coin: string;
      isLong: boolean;
      price: string;
      size: string;
    }) => {
      if (signingDisabled) return false;
      placeOrderMutation.mutate({
        orders: [
          {
            symbol: coin,
            side: isLong ? "sell" : "buy",
            quantity: size,
            price,
            reduceOnly: true,
            orderType: { kind: "limit", timeInForce: "GTC" },
          },
        ],
        grouping: "na",
      });
      return true;
    },
    [placeOrderMutation, signingDisabled],
  );

  return {
    handleCancelOrder,
    handleCancelAllConfirm,
    handleCloseMarket,
    submitCloseLimit,
    isCancelPending: cancelOrdersMutation.isPending,
    isPlacePending: placeOrderMutation.isPending,
  };
}
