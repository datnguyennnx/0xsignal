import { UnifiedAccountSummary } from "./unified-account-summary";
import { Surface } from "@/components/surface/surface";
import { OrderFormLeverage } from "./order-form-leverage";
import { OrderFormFields } from "./order-form-fields";
import { OrderFormSummary } from "./order-form-summary";
import { useOrderFormState } from "./order-form-state";
import { canPlace, frameClass } from "./order-form-derivations";

interface OrderFormProps {
  symbol: string;
  assetIndex: number;
  markPrice?: number;
}

export function OrderForm({ symbol, assetIndex, markPrice = 0 }: OrderFormProps) {
  const {
    adjustLeverageOpen,
    setAdjustLeverageOpen,
    marginModeOpen,
    setMarginModeOpen,
    setOverrideLeverage,
    setOverrideMarginMode,
    effectiveLeverage,
    effectiveMarginMode,
    szDecimals,
    maxLeverage,
    normalizedSymbol,
    currentAssetPosition,
    currentLeverageFromChain,
    currentMarginTypeFromChain,
    side,
    setSide,
    orderType,
    setOrderType,
    size,
    setSize,
    price,
    setPrice,
    priceInvalid,
    setPriceInvalid,
    setSizeAsset,
    usablePrice,
    orderValue,
    marginRequired,
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
    sizeAssetOptions,
    safeSizeAsset,
    effectiveBalance,
    handlePlaceOrder,
    isPending,
    signingDisabled,
  } = useOrderFormState({ symbol, markPrice });

  const orderCanPlace = canPlace({ signingDisabled, size, usablePrice, orderType, price });

  return (
    <Surface
      tier="content"
      radius="panel"
      className="h-full flex flex-col p-[var(--panel-pad,1.08rem)] gap-[var(--space-4,1.5rem)]"
    >
      {signingDisabled && (
        <p className="shrink-0 rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          Read-only view — trading is disabled while inspecting another account.
        </p>
      )}
      <div aria-disabled={signingDisabled} className={frameClass(signingDisabled)}>
        <OrderFormLeverage
          signingDisabled={signingDisabled}
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
          disabled={signingDisabled}
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
              canPlace={orderCanPlace}
              isPending={isPending}
              onPlaceOrder={handlePlaceOrder}
            />
          }
        />

        <div className="shrink-0">
          <UnifiedAccountSummary />
        </div>
      </div>
    </Surface>
  );
}
