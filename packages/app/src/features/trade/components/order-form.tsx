import { useState, useMemo, useCallback, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PlaceOrderRequest } from "@/services/api";
import type { PlaceOrderEntry } from "@0xsignal/shared";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useClearinghouseState, useSpotClearinghouseState } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { formatCompactUsd } from "@/core/utils/formatters";
import { usePlaceOrder } from "../hooks/use-place-order";
import { useTpSlOrchestration } from "../hooks/use-tp-sl-orchestration";
import { useLeverageMarginState } from "../hooks/use-leverage-margin-state";
import { LeverageMarginBar } from "./leverage-margin-bar";
import { AdjustLeverageModal } from "./adjust-leverage-modal";
import { MarginModeModal } from "./margin-mode-modal";
import { UnifiedAccountSummary } from "./unified-account-summary";
import { MARGIN_BUFFER, formatOrderSize } from "../utils/trade-math";
import { UnauthenticatedError } from "@/lib/api-base";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAppStore } from "@/stores/use-app-store";

interface OrderFormProps {
  symbol: string;
  assetIndex?: number;
  markPrice?: number;
}

export function OrderForm({ symbol, assetIndex = 0, markPrice = 0 }: OrderFormProps) {
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["trade-order-form"] ?? false);
  const openConnectWallet = useCallback(
    () => useAppStore.getState().openConnectWallet("trade-order-form"),
    [],
  );
  const closeConnectWallet = useCallback(
    () => useAppStore.getState().closeConnectWallet("trade-order-form"),
    [],
  );
  const { data: chData } = useClearinghouseState();
  const { data: spotData } = useSpotClearinghouseState();
  const { getPrecision } = useHyperliquidMeta();
  const { szDecimals, maxLeverage } = getPrecision(symbol);

  // Normalize: URL param may be lowercase ("btc") but API returns uppercase ("BTC")
  const normalizedSymbol = symbol.toUpperCase();
  const currentAssetPosition = chData?.assetPositions?.find(
    (ap) => ap.position.coin === normalizedSymbol,
  );
  const currentLeverageFromChain = currentAssetPosition?.position?.leverage?.value ?? 20;
  const currentMarginTypeFromChain: "cross" | "isolated" =
    currentAssetPosition?.position?.leverage?.type === "isolated" ? "isolated" : "cross";

  const {
    adjustLeverageOpen,
    setAdjustLeverageOpen,
    marginModeOpen,
    setMarginModeOpen,
    setOverrideLeverage,
    setOverrideMarginMode,
    effectiveLeverage,
    effectiveMarginMode,
  } = useLeverageMarginState({
    currentLeverageFromChain,
    currentMarginTypeFromChain,
  });

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [sliderPercent, setSliderPercent] = useState(0);
  const [price, setPrice] = useState("");
  const [priceInvalid, setPriceInvalid] = useState(false);

  const [sizeAsset, setSizeAsset] = useState("USDC");

  const currentPrice = markPrice || Number(price) || 0;
  const usablePrice = currentPrice > 0 ? currentPrice : orderType === "limit" ? Number(price) : 0;
  const orderValue = Number(size) || 0;
  const marginRequired = effectiveLeverage > 0 ? orderValue / effectiveLeverage : 0;
  const isLong = side === "buy";
  const entryPrice = orderType === "limit" ? Number(price) || 0 : markPrice || 0;

  const {
    tpSlEnabled,
    setTpSlEnabled,
    tpPrice,
    tpPercent,
    slPrice,
    slPercent,
    handleTpPercentChange,
    handleTpPriceChange,
    handleSlPercentChange,
    handleSlPriceChange,
    reduceOnly,
    setReduceOnly,
    showTpSl,
  } = useTpSlOrchestration({ entryPrice, effectiveLeverage, isLong });

  const marginSummary = chData?.marginSummary;
  const accountValue = Number(marginSummary?.accountValue || 0);
  const perpsUsdc = Number(chData?.withdrawable || 0);
  const spotUsdc = Number(spotData?.balances?.find((b) => b.coin === "USDC")?.total || 0);

  const sizeAssetOptions: Array<{ value: string; label: string; balance: number }> = useMemo(() => {
    const map = new Map<string, number>();
    if (accountValue > 0) map.set("USDC", perpsUsdc);
    for (const b of spotData?.balances ?? []) {
      const bal = Number(b.total);
      if (bal > 0) map.set(b.coin, bal);
    }
    if (!map.has("USDC") && spotUsdc > 0) map.set("USDC", spotUsdc);
    return Array.from(map.entries()).map(([coin, bal]) => ({
      value: coin,
      label: coin,
      balance: bal,
    }));
  }, [accountValue, perpsUsdc, spotUsdc, spotData]);

  const safeSizeAsset = sizeAssetOptions.some((o) => o.value === sizeAsset)
    ? sizeAsset
    : (sizeAssetOptions[0]?.value ?? "USDC");
  const effectiveBalance = sizeAssetOptions.find((o) => o.value === safeSizeAsset)?.balance ?? 0;

  const maxNotional = effectiveBalance * effectiveLeverage * MARGIN_BUFFER;

  const assetQtyDisplay =
    !usablePrice || !Number(size)
      ? null
      : `${formatOrderSize(Number(size) / usablePrice, szDecimals)} ${normalizedSymbol}`;

  const handleSliderCommit = (value: number | readonly number[]) => {
    const pct = (Array.isArray(value) ? value : [value])[0] ?? 0;
    setSliderPercent(pct);
    if (effectiveBalance <= 0 || effectiveLeverage <= 0) {
      setSize("0.00");
    } else {
      setSize(((maxNotional * pct) / 100).toFixed(2));
    }
  };

  const handlePctInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pct = Math.min(100, Math.max(0, Number(raw) || 0));
    setSliderPercent(pct);
    if (effectiveBalance <= 0 || effectiveLeverage <= 0) {
      setSize("0.00");
    } else {
      setSize(((maxNotional * pct) / 100).toFixed(2));
    }
  };

  const handleSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSize(val);
    const numVal = Number(val);
    if (numVal > 0 && maxNotional > 0) {
      setSliderPercent(Math.min(100, Math.round((numVal / maxNotional) * 100)));
    } else {
      setSliderPercent(0);
    }
  };

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
      setPriceInvalid(true);
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

  const canPlace = Boolean(
    Number(size) > 0 &&
    usablePrice > 0 &&
    !(orderType === "limit" && (!price || Number(price) <= 0)),
  );

  return (
    <>
      <div className="h-full flex flex-col rounded-xl p-4 material-raised animate-in fade-in duration-200 ease-premium gap-[clamp(0.75rem,1.25vw,1.25rem)]">
        <LeverageMarginBar
          effectiveMarginMode={effectiveMarginMode}
          effectiveLeverage={effectiveLeverage}
          onOpenMarginMode={() => setMarginModeOpen(true)}
          onOpenLeverage={() => setAdjustLeverageOpen(true)}
        />

        <div className="flex shrink-0">
          {(["market", "limit"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                "flex-1 pb-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                orderType === type
                  ? "border-b-2 border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70",
              )}
            >
              {type === "market" ? "Market" : "Limit"}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col gap-[clamp(1.5rem,3vw,3rem)]">
          <div className="relative flex h-10 rounded-md bg-muted p-0.5">
            <div
              className={cn(
                "absolute inset-y-0.5 w-[calc(50%-0.25rem)] rounded-[5px] transition-transform duration-500 ease-premium",
                side === "buy"
                  ? "translate-x-0.5 bg-gain"
                  : "translate-x-[calc(100%+0.5rem)] bg-loss",
              )}
            />
            <button
              onClick={() => setSide("buy")}
              className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[5px] transition-colors duration-200 cursor-pointer active:brightness-90"
            >
              <span
                className={side === "buy" ? "text-primary-foreground" : "text-muted-foreground"}
              >
                Buy / Long
              </span>
            </button>
            <button
              onClick={() => setSide("sell")}
              className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[5px] transition-colors duration-200 cursor-pointer active:brightness-90"
            >
              <span
                className={side === "sell" ? "text-primary-foreground" : "text-muted-foreground"}
              >
                Sell / Short
              </span>
            </button>
          </div>

          {orderType === "limit" && (
            <div className="space-y-1.5">
              <Label
                htmlFor="order-form-price"
                className="text-xs uppercase tracking-wider text-muted-foreground font-normal"
              >
                Price
              </Label>
              <Input
                id="order-form-price"
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceInvalid(false);
                }}
                placeholder="0.00"
                className="h-9 text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
                aria-invalid={priceInvalid}
              />
            </div>
          )}

          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="order-form-size"
                  className="text-xs uppercase tracking-wider text-muted-foreground font-normal"
                >
                  Size ({safeSizeAsset})
                </Label>
                {sizeAssetOptions.length > 1 && (
                  <NativeSelect
                    size="sm"
                    aria-label="Size asset"
                    value={safeSizeAsset}
                    onChange={(e) => setSizeAsset(e.target.value)}
                    wrapperClassName="min-w-0"
                    className="h-6 w-20 text-[length:var(--text-micro)] border-border/40 bg-background/70 text-muted-foreground tabular-nums"
                  >
                    {sizeAssetOptions.map((opt) => (
                      <NativeSelectOption key={opt.value} value={opt.value}>
                        {opt.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </div>
              <Input
                id="order-form-size"
                type="number"
                value={size}
                onChange={handleSizeChange}
                placeholder="0.00"
                className="h-9 w-full text-base sm:text-sm tabular-nums bg-background/70 border-border/40 hover:border-border/60 transition-colors"
              />
              {assetQtyDisplay && (
                <p className="text-[length:var(--text-micro)] text-muted-foreground tabular-nums text-right">
                  → {assetQtyDisplay}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-[clamp(0.75rem,1vw,1rem)]">
                <Slider
                  value={[sliderPercent]}
                  onValueChange={handleSliderCommit}
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Order size"
                  title="Order size"
                  className="flex-1 [&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-ring/40 [&_[data-slot=slider-track]]:hover:bg-muted/40 [&_[data-slot=slider-range]]:hover:brightness-110"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={sliderPercent}
                  onChange={handlePctInputChange}
                  aria-label="Size percentage"
                  className="w-16 h-8 text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40 px-1 shrink-0"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Available to Trade</span>
              <span className="text-xs tabular-nums text-foreground">
                {formatCompactUsd(effectiveBalance)} {safeSizeAsset}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            <label className="relative flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)] cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={reduceOnly}
                onChange={(e) => {
                  setReduceOnly(e.target.checked);
                  if (e.target.checked) setTpSlEnabled(false);
                }}
                className="sr-only peer"
              />
              <div
                className={cn(
                  "size-3.5 rounded border flex items-center justify-center transition-colors group-hover:border-border/60",
                  reduceOnly
                    ? "bg-foreground border-foreground"
                    : "border-border/40 bg-transparent",
                )}
              >
                {reduceOnly && <CheckIcon className="size-2.5 text-background" />}
              </div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Reduce Only
              </span>
            </label>

            <div className="space-y-3">
              <label className="relative flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)] cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={tpSlEnabled}
                  onChange={(e) => {
                    setTpSlEnabled(e.target.checked);
                    if (e.target.checked) setReduceOnly(false);
                  }}
                  className="sr-only peer"
                />
                <div
                  className={cn(
                    "size-3.5 rounded border flex items-center justify-center transition-colors group-hover:border-border/60",
                    tpSlEnabled
                      ? "bg-foreground border-foreground"
                      : "border-border/40 bg-transparent",
                  )}
                >
                  {tpSlEnabled && <CheckIcon className="size-2.5 text-background" />}
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Take Profit / Stop Loss
                </span>
              </label>

              {showTpSl && (
                <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)] pl-5">
                  <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                    <div className="flex-1">
                      <label htmlFor="order-form-tp-price" className="sr-only">
                        Take profit price
                      </label>
                      <Input
                        id="order-form-tp-price"
                        type="number"
                        value={tpPrice}
                        onChange={(e) => handleTpPriceChange(e.target.value)}
                        placeholder="TP Price"
                        className="h-8 text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
                      />
                    </div>
                    <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                      <label htmlFor="order-form-tp-gain" className="sr-only">
                        Take profit gain percent
                      </label>
                      <Input
                        id="order-form-tp-gain"
                        type="number"
                        value={tpPercent}
                        onChange={(e) => handleTpPercentChange(e.target.value)}
                        placeholder="Gain"
                        className="w-20 h-8 text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40"
                      />
                      <span className="text-xs text-muted-foreground w-4">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                    <div className="flex-1">
                      <label htmlFor="order-form-sl-price" className="sr-only">
                        Stop loss price
                      </label>
                      <Input
                        id="order-form-sl-price"
                        type="number"
                        value={slPrice}
                        onChange={(e) => handleSlPriceChange(e.target.value)}
                        placeholder="SL Price"
                        className="h-8 text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
                      />
                    </div>
                    <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                      <label htmlFor="order-form-sl-loss" className="sr-only">
                        Stop loss percent
                      </label>
                      <Input
                        id="order-form-sl-loss"
                        type="number"
                        value={slPercent}
                        onChange={(e) => handleSlPercentChange(e.target.value)}
                        placeholder="Loss"
                        className="w-20 h-8 text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40"
                      />
                      <span className="text-xs text-muted-foreground w-4">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Order Value</span>
              <span className="text-xs tabular-nums text-foreground">
                {orderValue > 0 ? `${formatCompactUsd(orderValue)} ${safeSizeAsset}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margin Required</span>
              <span className="text-xs tabular-nums text-foreground">
                {marginRequired > 0 ? formatCompactUsd(marginRequired) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Fees (Maker / Taker)</span>
              <span className="text-xs tabular-nums text-muted-foreground">0.0100% / 0.0350%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Liquidation Price</span>
              <span className="text-xs tabular-nums text-muted-foreground">N/A</span>
            </div>
          </div>

          <Button
            variant="default"
            onClick={handlePlaceOrder}
            disabled={!canPlace || placeOrderMutation.isPending}
            className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0 transition-[background-color,scale] duration-150 ease-premium active:scale-[0.98]"
          >
            {placeOrderMutation.isPending ? "Placing Order..." : "Place Order"}
          </Button>
        </div>

        <div className="shrink-0">
          <UnifiedAccountSummary />
        </div>
      </div>

      {/* ─── Modals (use chain-derived values, not local state, for initial props) ─── */}
      <AdjustLeverageModal
        open={adjustLeverageOpen}
        onOpenChange={setAdjustLeverageOpen}
        currentLeverage={currentLeverageFromChain}
        maxLeverage={maxLeverage}
        assetIndex={assetIndex}
        isCross={currentMarginTypeFromChain === "cross"}
        symbol={symbol}
        hasPosition={currentAssetPosition !== undefined}
        onConfirm={(newLev) => setOverrideLeverage(newLev)}
      />
      <MarginModeModal
        open={marginModeOpen}
        onOpenChange={setMarginModeOpen}
        currentMode={currentMarginTypeFromChain}
        assetIndex={assetIndex}
        currentLeverage={currentLeverageFromChain}
        symbol={symbol}
        onConfirm={(newMode) => setOverrideMarginMode(newMode)}
      />
      {isConnectWalletOpen && (
        <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
      )}
    </>
  );
}
