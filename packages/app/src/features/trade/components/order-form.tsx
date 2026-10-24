import { useState, useMemo } from "react";
import { useClearinghouseState, useSpotClearinghouseState } from "../hooks/use-user-data";
import { useHyperliquidMeta } from "../hooks/use-hyperliquid-meta";
import { useTpSlOrchestration } from "../hooks/use-tp-sl-orchestration";
import { useLeverageMarginState } from "../hooks/use-leverage-margin-state";
import { UnifiedAccountSummary } from "./unified-account-summary";
import { OrderFormLeverage } from "./order-form-leverage";
import { OrderFormFields } from "./order-form-fields";
import { OrderFormSummary } from "./order-form-summary";
import { useOrderFormSubmit } from "../hooks/use-order-form-submit";

interface OrderFormProps {
  symbol: string;
  assetIndex?: number;
  markPrice?: number;
}

export function OrderForm({ symbol, assetIndex = 0, markPrice = 0 }: OrderFormProps) {
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
  const accountValue = Number(marginSummary?.accountValue ?? 0);
  const perpsUsdc = Number(chData?.withdrawable ?? 0);
  const spotUsdc = Number(spotData?.balances?.find((b) => b.coin === "USDC")?.total ?? 0);

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

  const { handlePlaceOrder, isPending } = useOrderFormSubmit({
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
    onPriceInvalid: () => {
      setPriceInvalid(true);
    },
  });

  const canPlace =
    Number(size) > 0 &&
    usablePrice > 0 &&
    !(orderType === "limit" && (!price || Number(price) <= 0));

  return (
    <div className="h-full flex flex-col rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface gap-[var(--space-4,1.5rem)]">
      <OrderFormLeverage
        effectiveMarginMode={effectiveMarginMode}
        effectiveLeverage={effectiveLeverage}
        onMarginModeOpenChange={setMarginModeOpen}
        onAdjustLeverageOpenChange={setAdjustLeverageOpen}
        adjustLeverageOpen={adjustLeverageOpen}
        marginModeOpen={marginModeOpen}
        currentLeverage={currentLeverageFromChain}
        currentMarginMode={currentMarginTypeFromChain}
        maxLeverage={maxLeverage}
        assetIndex={assetIndex}
        symbol={symbol}
        hasPosition={currentAssetPosition !== undefined}
        onConfirmLeverage={setOverrideLeverage}
        onConfirmMarginMode={setOverrideMarginMode}
      />

      <OrderFormFields
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        side={side}
        onSideChange={setSide}
        price={price}
        onPriceChange={(value) => {
          setPrice(value);
          setPriceInvalid(false);
        }}
        priceInvalid={priceInvalid}
        size={size}
        onSizeChange={setSize}
        sliderPercent={sliderPercent}
        onSliderPercentChange={setSliderPercent}
        effectiveBalance={effectiveBalance}
        effectiveLeverage={effectiveLeverage}
        sizeAssetOptions={sizeAssetOptions}
        safeSizeAsset={safeSizeAsset}
        onSizeAssetChange={setSizeAsset}
        szDecimals={szDecimals}
        normalizedSymbol={normalizedSymbol}
        usablePrice={usablePrice}
        reduceOnly={reduceOnly}
        onReduceOnlyChange={(checked) => {
          setReduceOnly(checked);
          if (checked) setTpSlEnabled(false);
        }}
        tpSlEnabled={tpSlEnabled}
        onTpSlEnabledChange={(enabled) => {
          setTpSlEnabled(enabled);
          if (enabled) setReduceOnly(false);
        }}
        showTpSl={showTpSl}
        tpPrice={tpPrice}
        tpPercent={tpPercent}
        slPrice={slPrice}
        slPercent={slPercent}
        onTpPriceChange={handleTpPriceChange}
        onTpPercentChange={handleTpPercentChange}
        onSlPriceChange={handleSlPriceChange}
        onSlPercentChange={handleSlPercentChange}
        footer={
          <OrderFormSummary
            orderValue={orderValue}
            marginRequired={marginRequired}
            sizeAsset={safeSizeAsset}
            canPlace={canPlace}
            isPending={isPending}
            onPlaceOrder={handlePlaceOrder}
          />
        }
      />

      <div className="shrink-0">
        <UnifiedAccountSummary />
      </div>
    </div>
  );
}
