import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { api, type PlaceOrderRequest } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/core/utils/cn";
import { CheckIcon } from "lucide-react";
import { useClearinghouseState, useSpotClearinghouseState } from "../hooks/use-user-positions";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { AdjustLeverageModal } from "./adjust-leverage-modal";
import { MarginModeModal } from "./margin-mode-modal";
import { UnifiedAccountSummary } from "./unified-account-summary";
import {
  MARGIN_BUFFER,
  tpPriceFromPercent,
  slPriceFromPercent,
  gainPercentFromPrice,
  lossPercentFromPrice,
  fmtPrice,
  fmtPct,
  formatOrderSize,
} from "../utils/trade-math";

interface OrderFormProps {
  symbol: string;
  assetIndex?: number;
  markPrice?: number;
}

export function OrderForm({ symbol, assetIndex = 0, markPrice = 0 }: OrderFormProps) {
  const queryClient = useQueryClient();
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
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">(currentMarginTypeFromChain);
  const [leverage, setLeverage] = useState(currentLeverageFromChain);
  const [size, setSize] = useState("");
  const [sliderPercent, setSliderPercent] = useState(0);
  const [price, setPrice] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [tpPercent, setTpPercent] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slPercent, setSlPercent] = useState("");
  const [adjustLeverageOpen, setAdjustLeverageOpen] = useState(false);
  const [marginModeOpen, setMarginModeOpen] = useState(false);

  // Sync leverage/margin state when switching assets
  useEffect(() => {
    setLeverage(currentLeverageFromChain);
    setMarginMode(currentMarginTypeFromChain);
  }, [currentLeverageFromChain, currentMarginTypeFromChain]);

  /* ─── Derived values ─── */
  const currentPrice = markPrice || Number(price) || 0;
  const orderValue = Number(size) || 0;
  const marginRequired = leverage > 0 ? orderValue / leverage : 0;
  const showTpSl = tpSlEnabled && !reduceOnly;
  const isLong = side === "buy";
  const entryPrice = orderType === "limit" ? Number(price) || 0 : markPrice || 0;

  /* ─── Size / Slider sync — leverage-aware, falls back to Spot USDC ─── */

  // Derive effective available balance:
  // Use perps accountValue to detect if the perps account is initialized.
  // - accountValue > 0 (even if fully locked in positions) → use perps withdrawable
  // - accountValue === 0 (new user, no perps activity) → fall back to Spot USDC total
  const marginSummary = chData?.marginSummary;
  const accountValue = Number(marginSummary?.accountValue || 0);
  const perpsWithdrawable = Number(chData?.withdrawable || 0);
  const spotUsdc = Number(spotData?.balances?.find((b) => b.coin === "USDC")?.total || 0);
  const effectiveAvailableBalance = accountValue > 0 ? perpsWithdrawable : spotUsdc;

  // Max notional = balance × leverage (what the user can open)
  const maxNotional = effectiveAvailableBalance * leverage * MARGIN_BUFFER;

  /** Compute the size in USDC for a given percentage of maxNotional. */
  const sizeFromPct = useCallback(
    (pct: number): string => {
      if (effectiveAvailableBalance <= 0 || leverage <= 0) return "0.00";
      return ((maxNotional * pct) / 100).toFixed(2);
    },
    [maxNotional, effectiveAvailableBalance, leverage]
  );

  const handleSliderCommit = useCallback(
    (values: number[]) => {
      const pct = values[0] ?? 0;
      setSliderPercent(pct);
      setSize(sizeFromPct(pct));
    },
    [sizeFromPct]
  );

  const handlePctInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const pct = Math.min(100, Math.max(0, Number(raw) || 0));
      setSliderPercent(pct);
      setSize(sizeFromPct(pct));
    },
    [sizeFromPct]
  );

  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSize(val);
      const numVal = Number(val);
      if (numVal > 0 && maxNotional > 0) {
        const pct = Math.min(100, Math.round((numVal / maxNotional) * 100));
        setSliderPercent(pct);
      } else {
        setSliderPercent(0);
      }
    },
    [maxNotional]
  );

  /* ─── TP/SL two-way binding handlers ─── */

  // Track whether user actively typed in percent (to re-sync price on env change)
  const tpPercentRef = useRef("");
  const slPercentRef = useRef("");

  const handleTpPercentChange = useCallback(
    (raw: string) => {
      setTpPercent(raw);
      tpPercentRef.current = raw;
      const pct = Number(raw);
      if (entryPrice > 0 && leverage > 0 && pct > 0) {
        const price = tpPriceFromPercent(entryPrice, pct, leverage, isLong);
        setTpPrice(fmtPrice(price));
      } else {
        setTpPrice("");
      }
    },
    [entryPrice, leverage, isLong]
  );

  const handleTpPriceChange = useCallback(
    (raw: string) => {
      setTpPrice(raw);
      const px = Number(raw);
      if (entryPrice > 0 && leverage > 0 && px > 0) {
        const pct = gainPercentFromPrice(entryPrice, px, leverage, isLong);
        const formatted = fmtPct(pct);
        setTpPercent(formatted);
        tpPercentRef.current = formatted;
      } else {
        setTpPercent("");
        tpPercentRef.current = "";
      }
    },
    [entryPrice, leverage, isLong]
  );

  const handleSlPercentChange = useCallback(
    (raw: string) => {
      setSlPercent(raw);
      slPercentRef.current = raw;
      const pct = Number(raw);
      if (entryPrice > 0 && leverage > 0 && pct > 0) {
        const price = slPriceFromPercent(entryPrice, pct, leverage, isLong);
        setSlPrice(fmtPrice(price));
      } else {
        setSlPrice("");
      }
    },
    [entryPrice, leverage, isLong]
  );

  const handleSlPriceChange = useCallback(
    (raw: string) => {
      setSlPrice(raw);
      const px = Number(raw);
      if (entryPrice > 0 && leverage > 0 && px > 0) {
        const pct = lossPercentFromPrice(entryPrice, px, leverage, isLong);
        const formatted = fmtPct(pct);
        setSlPercent(formatted);
        slPercentRef.current = formatted;
      } else {
        setSlPercent("");
        slPercentRef.current = "";
      }
    },
    [entryPrice, leverage, isLong]
  );

  /* ─── Re-sync prices when environment changes (side/leverage/entryPrice) ─── */
  useEffect(() => {
    if (entryPrice > 0 && leverage > 0) {
      const tpPct = Number(tpPercentRef.current);
      if (tpPercentRef.current && tpPct > 0) {
        setTpPrice(fmtPrice(tpPriceFromPercent(entryPrice, tpPct, leverage, isLong)));
      }
      const slPct = Number(slPercentRef.current);
      if (slPercentRef.current && slPct > 0) {
        setSlPrice(fmtPrice(slPriceFromPercent(entryPrice, slPct, leverage, isLong)));
      }
    }
  }, [isLong, leverage, entryPrice]);

  /* ─── Place order mutation ─── */
  const placeOrderMutation = useMutation({
    mutationFn: (params: PlaceOrderRequest) => api.placeOrder(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.clearinghouseState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userData.openOrders() });
    },
  });

  const handlePlaceOrder = useCallback(() => {
    const effectivePrice =
      currentPrice > 0 ? currentPrice : orderType === "limit" ? Number(price) || 1 : 1;
    const rawSz = Number(size) / effectivePrice;
    const formattedSz = formatOrderSize(rawSz, szDecimals);

    const orders: PlaceOrderRequest["orders"] = [];

    const orderTypeConfig =
      orderType === "market"
        ? ({ limit: { tif: "FrontendMarket" as const } } as const)
        : ({ limit: { tif: "Gtc" as const } } as const);

    orders.push({
      a: assetIndex,
      b: side === "buy",
      p: orderType === "market" ? String(effectivePrice) : price || "1",
      s: formattedSz,
      r: reduceOnly,
      t: orderTypeConfig,
    });

    if (showTpSl && tpPrice) {
      orders.push({
        a: assetIndex,
        b: side !== "buy",
        p: tpPrice,
        s: formattedSz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: tpPrice, tpsl: "tp" as const } },
      });
    }

    if (showTpSl && slPrice) {
      orders.push({
        a: assetIndex,
        b: side !== "buy",
        p: slPrice,
        s: formattedSz,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: slPrice, tpsl: "sl" as const } },
      });
    }

    const payload: PlaceOrderRequest = { orders };
    if (showTpSl && tpPrice && slPrice) {
      payload.grouping = "normalTpsl";
    }

    placeOrderMutation.mutate(payload);
  }, [
    assetIndex,
    side,
    orderType,
    price,
    size,
    currentPrice,
    showTpSl,
    tpPrice,
    slPrice,
    reduceOnly,
    placeOrderMutation,
    szDecimals,
  ]);

  const canPlace = Boolean(
    size && Number(size) > 0 && (orderType === "market" || Boolean(price && Number(price) > 0))
  );

  return (
    <>
      <div className="flex flex-col bg-card border border-border/30 rounded-xl overflow-hidden h-full">
        {/* ════════════════ TOP CONTROLS: margin mode / leverage / classic ════════════════ */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/20 shrink-0">
          <button
            onClick={() => setMarginModeOpen(true)}
            className="flex-1 h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/30 rounded border border-border/30 transition-colors truncate"
          >
            {marginMode === "cross" ? "Cross" : "Isolated"}
          </button>
          <button
            onClick={() => setAdjustLeverageOpen(true)}
            className="flex-1 h-9 px-2 text-xs font-mono tabular-nums text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/30 rounded border border-border/30 transition-colors"
          >
            {leverage}x
          </button>
          <button
            disabled
            className="flex-1 h-9 px-2 text-xs text-muted-foreground/40 bg-muted/10 rounded border border-border/30 cursor-not-allowed truncate"
          >
            Classic
          </button>
        </div>

        {/* ════════════════ ORDER TYPE TABS: MARKET / LIMIT ════════════════ */}
        <div className="flex shrink-0 px-4 pt-3 border-b border-border/20">
          {(["market", "limit"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                "flex-1 pb-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                "border-b-2",
                orderType === type
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground/70"
              )}
            >
              {type === "market" ? "Market" : "Limit"}
            </button>
          ))}
        </div>

        {/* ════════════════ SCROLLABLE FORM BODY ════════════════ */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-4">
            {/* ─── Buy / Sell Toggle — linked sliding pill ─── */}
            <div className="relative flex h-10 rounded-md bg-muted/10 p-0.5">
              {/* Sliding indicator */}
              <div
                className={cn(
                  "absolute inset-y-0.5 w-1/2 rounded-[5px] transition-all duration-500 ease-premium",
                  side === "buy" ? "left-0.5 bg-gain" : "left-[calc(50%-0.125rem)] bg-loss"
                )}
              />
              <button
                onClick={() => setSide("buy")}
                className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[5px] transition-colors duration-200 cursor-pointer"
              >
                <span className={side === "buy" ? "text-white" : "text-muted-foreground"}>
                  Buy / Long
                </span>
              </button>
              <button
                onClick={() => setSide("sell")}
                className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[5px] transition-colors duration-200 cursor-pointer"
              >
                <span className={side === "sell" ? "text-white" : "text-muted-foreground"}>
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
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-xs tabular-nums bg-background/70 border-border/30"
                />
              </div>
            )}

            {/* ─── Size Input (USDC) ─── */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
                Size (USDC)
              </Label>
              <Input
                type="number"
                value={size}
                onChange={handleSizeChange}
                placeholder="0.00"
                className="h-9 w-full text-xs tabular-nums bg-background/70 border-border/30 hover:border-border/60 transition-colors"
              />
            </div>

            {/* ─── Size Percentage Slider ─── */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center gap-3">
                <Slider
                  value={[sliderPercent]}
                  onValueChange={handleSliderCommit}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1 [&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-ring/40 [&_[data-slot=slider-track]]:hover:bg-muted/40 [&_[data-slot=slider-range]]:hover:brightness-110"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={sliderPercent}
                  onChange={handlePctInputChange}
                  className="w-16 h-8 text-xs text-center tabular-nums bg-background/70 border-border/30 px-1 shrink-0"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <div className="flex justify-between">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      setSliderPercent(pct);
                      setSize(sizeFromPct(pct));
                    }}
                    className={cn(
                      "text-xs px-2 py-1 rounded transition-colors cursor-pointer",
                      sliderPercent === pct
                        ? "text-foreground font-medium bg-muted/20"
                        : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/10"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Available to Trade ─── */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Available to Trade</span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                ${effectiveAvailableBalance.toFixed(2)} USDC
              </span>
            </div>

            {/* ─── TP/SL ─── */}
            <div className="space-y-3 pt-2 border-t border-border/20">
              <label className="relative flex items-center gap-2 cursor-pointer select-none group">
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
                <div className="space-y-2 pl-5">
                  {/* Row 1: TP Price + Gain % */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={tpPrice}
                        onChange={(e) => handleTpPriceChange(e.target.value)}
                        placeholder="TP Price"
                        className="h-8 text-xs tabular-nums bg-background/70 border-border/30"
                      />
                    </div>
                    <div className="flex items-center gap-1">
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

                  {/* Row 2: SL Price + Loss % */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={slPrice}
                        onChange={(e) => handleSlPriceChange(e.target.value)}
                        placeholder="SL Price"
                        className="h-8 text-xs tabular-nums bg-background/70 border-border/30"
                      />
                    </div>
                    <div className="flex items-center gap-1">
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

            {/* ─── Reduce Only ─── */}
            <div className={cn(tpSlEnabled && showTpSl ? "pt-0" : "pt-1")}>
              <label className="relative flex items-center gap-2 cursor-pointer select-none group">
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
                      : "border-border/30 bg-transparent"
                  )}
                >
                  {reduceOnly && <CheckIcon className="size-2.5 text-background" />}
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Reduce Only
                </span>
              </label>
            </div>

            {/* ─── Order Summary ─── */}
            <div className="space-y-2 pt-2 border-t border-border/20">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Order Value</span>
                <span className="text-xs font-mono tabular-nums text-foreground">
                  {orderValue > 0 ? `$${orderValue.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Margin Required</span>
                <span className="text-xs font-mono tabular-nums text-foreground">
                  {marginRequired > 0 ? `$${marginRequired.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fees (Maker / Taker)</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  0.0100% / 0.0350%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Liquidation Price</span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">N/A</span>
              </div>
            </div>
          </div>

          {/* ─── Place Order Button ─── */}
          <div className="px-4 pb-3 pt-2">
            <Button
              onClick={handlePlaceOrder}
              disabled={!canPlace || placeOrderMutation.isPending}
              className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg border-0 transition-all duration-150 bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
            >
              {placeOrderMutation.isPending ? "Placing Order..." : "Place Order"}
            </Button>
          </div>
        </div>

        {/* ════════════════ FIXED BOTTOM: Unified Account Summary ════════════════ */}
        <div className="shrink-0 border-t border-border/20">
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
        onConfirm={(newLev) => setLeverage(newLev)}
      />
      <MarginModeModal
        open={marginModeOpen}
        onOpenChange={setMarginModeOpen}
        currentMode={currentMarginTypeFromChain}
        assetIndex={assetIndex}
        currentLeverage={currentLeverageFromChain}
        symbol={symbol}
        onConfirm={(newMode) => setMarginMode(newMode)}
      />
    </>
  );
}
