import { useState, useMemo, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, type PlaceOrderRequest } from "@/services/api";
import type { PlaceOrderEntry } from "@0xsignal/shared";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/core/utils/cn";
import { CheckIcon } from "lucide-react";
import { useClearinghouseState, useSpotClearinghouseState } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useTakeProfitStopLoss } from "../hooks/use-take-profit-stop-loss";
import { AdjustLeverageModal } from "./adjust-leverage-modal";
import { MarginModeModal } from "./margin-mode-modal";
import { UnifiedAccountSummary } from "./unified-account-summary";
import { MARGIN_BUFFER, formatOrderSize } from "../utils/trade-math";
import { UnauthenticatedError } from "@/lib/api-base";
import { useConnectWalletPrompt } from "@/hooks/use-connect-wallet-prompt";

interface OrderFormProps {
  symbol: string;
  assetIndex?: number;
  markPrice?: number;
}

export function OrderForm({ symbol, assetIndex = 0, markPrice = 0 }: OrderFormProps) {
  const queryClient = useQueryClient();
  const { open: openConnectWallet, ConnectWalletSheet } = useConnectWalletPrompt();
  const { data: chData } = useClearinghouseState();
  const { data: spotData } = useSpotClearinghouseState();
  const { getPrecision } = useHyperliquidMeta();
  const { szDecimals, maxLeverage } = getPrecision(symbol);

  /* ─── Derive current leverage/margin from clearinghouse state ─── */
  // Normalize: URL param may be lowercase ("btc") but API returns uppercase ("BTC")
  const normalizedSymbol = symbol.toUpperCase();
  const currentAssetPosition = chData?.assetPositions?.find(
    (ap) => ap.position.coin === normalizedSymbol
  );
  const currentLeverageFromChain = currentAssetPosition?.position?.leverage?.value ?? 20;
  const currentMarginTypeFromChain: "cross" | "isolated" =
    currentAssetPosition?.position?.leverage?.type === "isolated" ? "isolated" : "cross";

  /* ─── Core state (init from chain, updated via modals) ─── */
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [overrideLeverage, setOverrideLeverage] = useState<number | null>(null);
  const [overrideMarginMode, setOverrideMarginMode] = useState<"cross" | "isolated" | null>(null);
  const effectiveLeverage = overrideLeverage ?? currentLeverageFromChain;
  const effectiveMarginMode = overrideMarginMode ?? currentMarginTypeFromChain;
  const [size, setSize] = useState("");
  const [sliderPercent, setSliderPercent] = useState(0);
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [adjustLeverageOpen, setAdjustLeverageOpen] = useState(false);
  const [marginModeOpen, setMarginModeOpen] = useState(false);

  /** Sizing asset — dynamic from user's balances + perps USDC. */
  const [sizeAsset, setSizeAsset] = useState("USDC");

  /* ─── Derived values ─── */
  const currentPrice = markPrice || Number(price) || 0;
  const usablePrice = currentPrice > 0 ? currentPrice : orderType === "limit" ? Number(price) : 0;
  const orderValue = Number(size) || 0;
  const marginRequired = effectiveLeverage > 0 ? orderValue / effectiveLeverage : 0;
  const isLong = side === "buy";
  const entryPrice = orderType === "limit" ? Number(price) || 0 : markPrice || 0;

  /* ─── TP/SL state orchestration ─── */
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
  } = useTakeProfitStopLoss({ entryPrice, effectiveLeverage, isLong });

  const showTpSl = tpSlEnabled && !reduceOnly;

  /* ─── Size / Slider sync — leverage-aware, falls back to Spot USDC ─── */

  // Derive available balances:
  // - Perps USDC (from clearinghouse withdrawable)
  // - Spot tokens (from spotClearinghouseState)
  const marginSummary = chData?.marginSummary;
  const accountValue = Number(marginSummary?.accountValue || 0);
  const perpsUsdc = Number(chData?.withdrawable || 0);
  const spotUsdc = Number(spotData?.balances?.find((b) => b.coin === "USDC")?.total || 0);

  // Build options: perps USDC (priority) then all non-zero spot balances
  const sizeAssetOptions: Array<{ value: string; label: string; balance: number }> = useMemo(() => {
    const map = new Map<string, number>();
    // Perps USDC is always the first option if account is active
    if (accountValue > 0) map.set("USDC", perpsUsdc);
    // Spot balances for all tokens user holds
    for (const b of spotData?.balances ?? []) {
      const bal = Number(b.total);
      if (bal > 0) map.set(b.coin, bal);
    }
    // If no perps account, use spot USDC as default USDC
    if (!map.has("USDC") && spotUsdc > 0) map.set("USDC", spotUsdc);
    return Array.from(map.entries()).map(([coin, bal]) => ({
      value: coin,
      label: coin,
      balance: bal,
    }));
  }, [accountValue, perpsUsdc, spotUsdc, spotData]);

  // Default to first option if current selection is no longer available
  const safeSizeAsset = sizeAssetOptions.some((o) => o.value === sizeAsset)
    ? sizeAsset
    : (sizeAssetOptions[0]?.value ?? "USDC");
  const effectiveBalance = sizeAssetOptions.find((o) => o.value === safeSizeAsset)?.balance ?? 0;

  // Max notional = balance × leverage (what the user can open)
  const maxNotional = effectiveBalance * effectiveLeverage * MARGIN_BUFFER;

  // Show converted asset quantity below the size input
  const assetQtyDisplay =
    !usablePrice || !Number(size)
      ? null
      : `${formatOrderSize(Number(size) / usablePrice, szDecimals)} ${normalizedSymbol}`;

  const handleSliderCommit = (values: number[]) => {
    const pct = values[0] ?? 0;
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

  /* ─── Place order mutation ─── */
  const placeOrderMutation = useMutation({
    mutationFn: (params: PlaceOrderRequest) => api.placeOrder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.openOrders() });
    },
    onError: (err) => {
      if (err instanceof UnauthenticatedError) {
        openConnectWallet();
      }
    },
  });

  const handlePlaceOrder = () => {
    if (orderType === "limit" && (!price || Number(price) <= 0)) {
      setPriceError("Please enter a valid limit price");
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
    !(orderType === "limit" && (!price || Number(price) <= 0))
  );

  return (
    <>
      <div className="h-full flex flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium gap-[clamp(0.75rem,1.25vw,1.25rem)]">
        {/* Top controls */}
        <div className="flex items-center gap-[clamp(0.75rem,1vw,1rem)] shrink-0">
          <button
            onClick={() => setMarginModeOpen(true)}
            className="flex-1 h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/30 rounded border border-border/30 transition-colors truncate active:scale-[0.97]"
          >
            {effectiveMarginMode === "cross" ? "Cross" : "Isolated"}
          </button>
          <button
            onClick={() => setAdjustLeverageOpen(true)}
            className="flex-1 h-9 px-2 text-xs tabular-nums text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/30 rounded border border-border/30 transition-colors active:scale-[0.97]"
          >
            {effectiveLeverage}x
          </button>
          <button
            disabled
            className="flex-1 h-9 px-2 text-xs text-muted-foreground/40 bg-muted/10 rounded border border-border/30 cursor-not-allowed truncate"
          >
            Classic
          </button>
        </div>

        {/* Order type tabs */}
        <div className="flex shrink-0">
          {(["market", "limit"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                "flex-1 pb-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                orderType === type
                  ? "border-b-2 border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70"
              )}
            >
              {type === "market" ? "Market" : "Limit"}
            </button>
          ))}
        </div>

        {/* Form body — takes remaining flex space, no internal scroll */}
        <div className="flex-1 flex flex-col gap-[clamp(1.5rem,3vw,3rem)]">
          {/* ─── Buy / Sell Toggle — linked sliding pill ─── */}
          <div className="relative flex h-10 rounded-md bg-muted/10 p-0.5">
            {/* Sliding indicator */}
            <div
              className={cn(
                "absolute inset-y-0.5 w-[calc(50%-0.25rem)] rounded-[5px] transition-transform duration-500 ease-premium",
                side === "buy"
                  ? "translate-x-0.5 bg-gain"
                  : "translate-x-[calc(100%+0.5rem)] bg-loss"
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

          {/* ─── Price Input (limit only) ─── */}
          {orderType === "limit" && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
                Price
              </Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceError(null);
                }}
                placeholder="0.00"
                className="h-9 text-xs tabular-nums bg-background/70 border-border/30"
                aria-invalid={!!priceError}
              />
              {priceError && <p className="text-[10px] text-destructive/80 mt-1">{priceError}</p>}
            </div>
          )}

          {/* ─── Order Entry: Size + Slider + Available ─── */}
          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            {/* Size Input with Asset Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
                  Size ({safeSizeAsset})
                </Label>
                {sizeAssetOptions.length > 1 && (
                  <NativeSelect
                    size="sm"
                    aria-label="Size asset"
                    value={safeSizeAsset}
                    onChange={(e) => setSizeAsset(e.target.value)}
                    wrapperClassName="min-w-0"
                    className="h-6 w-20 text-[10px] border-border/30 bg-background/70 text-muted-foreground tabular-nums"
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
                type="number"
                value={size}
                onChange={handleSizeChange}
                placeholder="0.00"
                className="h-9 w-full text-xs tabular-nums bg-background/70 border-border/30 hover:border-border/60 transition-colors"
              />
              {assetQtyDisplay && (
                <p className="text-[10px] text-muted-foreground/60 tabular-nums text-right">
                  → {assetQtyDisplay}
                </p>
              )}
            </div>

            {/* Size Percentage Slider */}
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
                  className="w-16 h-8 text-xs text-center tabular-nums bg-background/70 border-border/30 px-1 shrink-0"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>

            {/* Available to Trade */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Available to Trade</span>
              <span className="text-xs tabular-nums text-foreground">
                ${effectiveBalance.toFixed(2)} {safeSizeAsset}
              </span>
            </div>
          </div>

          {/* ─── Order Options: Reduce Only + TP/SL ─── */}
          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            {/* Reduce Only */}
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
                  reduceOnly ? "bg-foreground border-foreground" : "border-border/30 bg-transparent"
                )}
              >
                {reduceOnly && <CheckIcon className="size-2.5 text-background" />}
              </div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Reduce Only
              </span>
            </label>

            {/* TP/SL */}
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
                      : "border-border/30 bg-transparent"
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
                      <Input
                        type="number"
                        value={tpPrice}
                        onChange={(e) => handleTpPriceChange(e.target.value)}
                        placeholder="TP Price"
                        className="h-8 text-xs tabular-nums bg-background/70 border-border/30"
                      />
                    </div>
                    <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                      <Input
                        type="number"
                        value={tpPercent}
                        onChange={(e) => handleTpPercentChange(e.target.value)}
                        placeholder="Gain"
                        className="w-20 h-8 text-xs text-center tabular-nums bg-background/70 border-border/30"
                      />
                      <span className="text-xs text-muted-foreground w-4">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={slPrice}
                        onChange={(e) => handleSlPriceChange(e.target.value)}
                        placeholder="SL Price"
                        className="h-8 text-xs tabular-nums bg-background/70 border-border/30"
                      />
                    </div>
                    <div className="flex items-center gap-[clamp(0.5rem,0.8vw,0.75rem)]">
                      <Input
                        type="number"
                        value={slPercent}
                        onChange={(e) => handleSlPercentChange(e.target.value)}
                        placeholder="Loss"
                        className="w-20 h-8 text-xs text-center tabular-nums bg-background/70 border-border/30"
                      />
                      <span className="text-xs text-muted-foreground w-4">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Order Summary ─── */}
          <div className="flex flex-col gap-[clamp(0.5rem,0.8vw,0.75rem)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Order Value</span>
              <span className="text-xs tabular-nums text-foreground">
                {orderValue > 0 ? `$${orderValue.toFixed(2)} ${safeSizeAsset}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margin Required</span>
              <span className="text-xs tabular-nums text-foreground">
                {marginRequired > 0 ? `$${marginRequired.toFixed(2)}` : "—"}
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

          {/* ─── Place Order Button ─── */}
          <Button
            onClick={handlePlaceOrder}
            disabled={!canPlace || placeOrderMutation.isPending}
            className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0 transition-all duration-150 ease-premium bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
          >
            {placeOrderMutation.isPending ? "Placing Order..." : "Place Order"}
          </Button>
        </div>

        {/* ════════════════ FIXED BOTTOM: Unified Account Summary ════════════════ */}
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
      {ConnectWalletSheet}
    </>
  );
}
