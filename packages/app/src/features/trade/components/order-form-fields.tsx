import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { formatAxis, formatCompactUsd } from "@/core/utils/formatters";
import type { SizeAssetOption } from "./order-form-derivations";
import { OrderSizeField } from "./order-size-field";

interface OrderFormFieldsProps {
  disabled?: boolean;
  orderType: "market" | "limit";
  onOrderTypeChange: (orderType: "market" | "limit") => void;
  side: "buy" | "sell";
  onSideChange: (side: "buy" | "sell") => void;
  price: string;
  onPriceChange: (price: string) => void;
  priceInvalid: boolean;
  size: string;
  onSizeChange: (size: string) => void;
  effectiveBalance: number;
  effectiveLeverage: number;
  sizeAssetOptions: SizeAssetOption[];
  safeSizeAsset: string;
  onSizeAssetChange: (asset: string) => void;
  szDecimals: number;
  normalizedSymbol: string;
  usablePrice: number;
  reduceOnly: boolean;
  onReduceOnlyChange: (checked: boolean) => void;
  tpSlEnabled: boolean;
  onTpSlEnabledChange: (enabled: boolean) => void;
  showTpSl: boolean;
  tpPrice: string;
  tpPercent: string;
  slPrice: string;
  slPercent: string;
  onTpPriceChange: (value: string) => void;
  onTpPercentChange: (value: string) => void;
  onSlPriceChange: (value: string) => void;
  onSlPercentChange: (value: string) => void;
  footer: ReactNode;
}

interface TpSlPriceRowProps {
  kind: "tp" | "sl";
  price: string;
  percent: string;
  onPriceChange: (value: string) => void;
  onPercentChange: (value: string) => void;
}

const TPSL_LABELS = {
  tp: {
    pricePlaceholder: "TP Price",
    percentPlaceholder: "Gain",
    priceLabel: "Take profit price",
    percentLabel: "Take profit gain percent",
    percentSuffix: "gain",
  },
  sl: {
    pricePlaceholder: "SL Price",
    percentPlaceholder: "Loss",
    priceLabel: "Stop loss price",
    percentLabel: "Stop loss percent",
    percentSuffix: "loss",
  },
} as const;

function TpSlPriceRow({ kind, price, percent, onPriceChange, onPercentChange }: TpSlPriceRowProps) {
  const labels = TPSL_LABELS[kind];
  return (
    <div className="row-actions">
      <div className="flex-1">
        <label htmlFor={`order-form-${kind}-price`} className="sr-only">
          {labels.priceLabel}
        </label>
        <Input
          id={`order-form-${kind}-price`}
          type="number"
          value={price}
          onChange={(e) => {
            onPriceChange(e.target.value);
          }}
          placeholder={labels.pricePlaceholder}
          className="tabular-nums"
        />
      </div>
      <div className="flex items-center gap-1">
        <label htmlFor={`order-form-${kind}-${labels.percentSuffix}`} className="sr-only">
          {labels.percentLabel}
        </label>
        <Input
          id={`order-form-${kind}-${labels.percentSuffix}`}
          type="number"
          value={percent}
          onChange={(e) => {
            onPercentChange(e.target.value);
          }}
          placeholder={labels.percentPlaceholder}
          className="w-20 text-center tabular-nums"
        />
        <span className="type-label text-muted-foreground w-4">%</span>
      </div>
    </div>
  );
}

export function OrderFormFields({
  disabled = false,
  orderType,
  onOrderTypeChange,
  side,
  onSideChange,
  price,
  onPriceChange,
  priceInvalid,
  size,
  onSizeChange,
  effectiveBalance,
  effectiveLeverage,
  sizeAssetOptions,
  safeSizeAsset,
  onSizeAssetChange,
  szDecimals,
  normalizedSymbol,
  usablePrice,
  reduceOnly,
  onReduceOnlyChange,
  tpSlEnabled,
  onTpSlEnabledChange,
  showTpSl,
  tpPrice,
  tpPercent,
  slPrice,
  slPercent,
  onTpPriceChange,
  onTpPercentChange,
  onSlPriceChange,
  onSlPercentChange,
  footer,
}: OrderFormFieldsProps) {
  return (
    <fieldset disabled={disabled} aria-disabled={disabled} className="contents">
      <Tabs
        value={orderType}
        onValueChange={(value: unknown) => {
          if (value === "market" || value === "limit") onOrderTypeChange(value);
        }}
        className="shrink-0"
      >
        <TabsList variant="line" className="w-full gap-1">
          {(["market", "limit"] as const).map((type) => (
            <TabsTrigger
              key={type}
              value={type}
              variant="text"
              className="flex-1 uppercase tracking-wider"
            >
              {type === "market" ? "Market" : "Limit"}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto panel-contain gap-3 pb-4">
        <div className="relative flex rounded-control tier-well gap-1 mt-2">
          <Toggle
            pressed={side === "buy"}
            onPressedChange={() => {
              onSideChange("buy");
            }}
            material="none"
            data-semantic-fill="gain"
            className="relative z-10 flex-1 cursor-pointer font-semibold uppercase tracking-wider transition-[background-color,box-shadow,border-color,transform] duration-(--dur-fast) ease-standard hover:bg-transparent aria-pressed:bg-gain aria-pressed:shadow-[inset_0_1px_0_var(--semantic-fill-rim)] aria-pressed:hover:bg-gain active:brightness-90"
          >
            <span className={side === "buy" ? "text-gain-foreground" : "text-muted-foreground"}>
              Buy / Long
            </span>
          </Toggle>
          <Toggle
            pressed={side === "sell"}
            onPressedChange={() => {
              onSideChange("sell");
            }}
            material="none"
            data-semantic-fill="loss"
            className="relative z-10 flex-1 cursor-pointer font-semibold uppercase tracking-wider transition-[background-color,box-shadow,border-color,transform] duration-(--dur-fast) ease-standard hover:bg-transparent aria-pressed:bg-loss aria-pressed:shadow-[inset_0_1px_0_var(--semantic-fill-rim)] aria-pressed:hover:bg-loss active:brightness-90"
          >
            <span className={side === "sell" ? "text-loss-foreground" : "text-muted-foreground"}>
              Sell / Short
            </span>
          </Toggle>
        </div>

        {orderType === "limit" && (
          <div className="flex flex-col">
            <Label
              htmlFor="order-form-price"
              className="mb-1 type-label uppercase tracking-wider text-muted-foreground font-normal"
            >
              Price
            </Label>
            <Input
              id="order-form-price"
              type="number"
              value={price}
              onChange={(e) => {
                onPriceChange(e.target.value);
              }}
              placeholder="0.00"
              className="tabular-nums"
              aria-invalid={priceInvalid}
            />
          </div>
        )}

        <div className="flex flex-col gap-field">
          <OrderSizeField
            size={size}
            onSizeChange={onSizeChange}
            effectiveBalance={effectiveBalance}
            effectiveLeverage={effectiveLeverage}
            usablePrice={usablePrice}
            szDecimals={szDecimals}
            normalizedSymbol={normalizedSymbol}
            safeSizeAsset={safeSizeAsset}
            sizeAssetOptions={sizeAssetOptions}
            onSizeAssetChange={onSizeAssetChange}
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="type-label text-muted-foreground">Available to Trade</span>
          <span className="type-label tabular-nums text-foreground">
            {safeSizeAsset === QUOTE_ASSET
              ? formatCompactUsd(effectiveBalance)
              : `${formatAxis(effectiveBalance)} ${safeSizeAsset}`}
          </span>
        </div>

        <div className="flex flex-col gap-field mt-4">
          <Checkbox checked={reduceOnly} onCheckedChange={onReduceOnlyChange}>
            <span className="type-label uppercase tracking-wider text-muted-foreground">
              Reduce Only
            </span>
          </Checkbox>

          <div className="flex flex-col gap-field">
            <Checkbox checked={tpSlEnabled} onCheckedChange={onTpSlEnabledChange}>
              <span className="type-label uppercase tracking-wider text-muted-foreground">
                Take Profit / Stop Loss
              </span>
            </Checkbox>

            {showTpSl && (
              <div className="flex flex-col gap-field pl-4">
                <TpSlPriceRow
                  kind="tp"
                  price={tpPrice}
                  percent={tpPercent}
                  onPriceChange={onTpPriceChange}
                  onPercentChange={onTpPercentChange}
                />
                <TpSlPriceRow
                  kind="sl"
                  price={slPrice}
                  percent={slPercent}
                  onPriceChange={onSlPriceChange}
                  onPercentChange={onSlPercentChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3">{footer}</div>
    </fieldset>
  );
}
