import type { ChangeEvent, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { MARGIN_BUFFER, formatOrderSize } from "../utils/trade-math";
import { formatCompactUsd } from "@/core/utils/formatters";

interface SizeAssetOption {
  value: string;
  label: string;
  balance: number;
}

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
  sliderPercent: number;
  onSliderPercentChange: (percent: number) => void;
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
  sliderPercent,
  onSliderPercentChange,
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
  const maxNotional = effectiveBalance * effectiveLeverage * MARGIN_BUFFER;

  const assetQtyDisplay =
    !usablePrice || !Number(size)
      ? null
      : `${formatOrderSize(Number(size) / usablePrice, szDecimals)} ${normalizedSymbol}`;

  const applyPercent = (pct: number) => {
    onSliderPercentChange(pct);
    if (effectiveBalance <= 0 || effectiveLeverage <= 0) {
      onSizeChange("0.00");
    } else {
      onSizeChange(((maxNotional * pct) / 100).toFixed(2));
    }
  };

  const handleSliderCommit = (value: number | readonly number[]) => {
    const pct = typeof value === "number" ? value : (value[0] ?? 0);
    applyPercent(pct);
  };

  const handlePctInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pct = Math.min(100, Math.max(0, Number(raw) || 0));
    applyPercent(pct);
  };

  const handleSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onSizeChange(val);
    const numVal = Number(val);
    if (numVal > 0 && maxNotional > 0) {
      onSliderPercentChange(Math.min(100, Math.round((numVal / maxNotional) * 100)));
    } else {
      onSliderPercentChange(0);
    }
  };

  return (
    <fieldset disabled={disabled} className="contents">
      <div className="flex shrink-0">
        {(["market", "limit"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              onOrderTypeChange(type);
            }}
            className={cn(
              "flex-1 pb-[var(--space-1,0.3125rem)] text-xs font-medium uppercase tracking-wider transition-colors",
              orderType === type
                ? "border-b-2 border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/70",
            )}
          >
            {type === "market" ? "Market" : "Limit"}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="relative flex h-[var(--field-h,2.75rem)] rounded-md bg-muted p-0.5 gap-1">
          <div
            className={cn(
              "absolute inset-y-0.5 w-[calc(50%-0.25rem)] rounded-[0.3125rem] transition-transform duration-150 ease-premium",
              side === "buy"
                ? "translate-x-0.5 bg-gain"
                : "translate-x-[calc(100%+0.375rem)] bg-loss",
            )}
          />
          <button
            onClick={() => {
              onSideChange("buy");
            }}
            className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[0.3125rem] transition-colors duration-200 cursor-pointer active:brightness-90"
          >
            <span className={side === "buy" ? "text-primary-foreground" : "text-muted-foreground"}>
              Buy / Long
            </span>
          </button>
          <button
            onClick={() => {
              onSideChange("sell");
            }}
            className="relative flex-1 z-10 h-full text-xs font-semibold uppercase tracking-wider rounded-[0.3125rem] transition-colors duration-200 cursor-pointer active:brightness-90"
          >
            <span className={side === "sell" ? "text-primary-foreground" : "text-muted-foreground"}>
              Sell / Short
            </span>
          </button>
        </div>

        {orderType === "limit" && (
          <div className="flex flex-col mt-[var(--space-4,1.5rem)]">
            <Label
              htmlFor="order-form-price"
              className="mb-[var(--space-1,0.3125rem)] text-xs uppercase tracking-wider text-muted-foreground font-normal"
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
              className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
              aria-invalid={priceInvalid}
            />
          </div>
        )}

        <div className="flex flex-col gap-[var(--space-2,0.75rem)] mt-[var(--space-4,1.5rem)]">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-[var(--space-1,0.3125rem)]">
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
                  onChange={(e) => {
                    onSizeAssetChange(e.target.value);
                  }}
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
              className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] w-full text-base sm:text-sm tabular-nums bg-background/70 border-border/40 hover:border-border/60 transition-colors"
            />
            {assetQtyDisplay !== null && (
              <p className="mt-[var(--space-1,0.3125rem)] text-[length:var(--text-micro)] text-muted-foreground tabular-nums text-right">
                → {assetQtyDisplay}
              </p>
            )}
          </div>

          <div className="flex items-center gap-[var(--space-2,0.75rem)]">
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
              className="w-16 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40 shrink-0"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-[var(--space-3,1.125rem)] py-[var(--space-1,0.3125rem)]">
          <span className="text-xs text-muted-foreground">Available to Trade</span>
          <span className="text-xs tabular-nums text-foreground">
            {formatCompactUsd(effectiveBalance)} {safeSizeAsset}
          </span>
        </div>

        <div className="flex flex-col gap-[var(--space-2,0.75rem)] mt-[var(--space-4,1.5rem)]">
          <label className="relative flex items-center gap-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={reduceOnly}
              onChange={(e) => {
                onReduceOnlyChange(e.target.checked);
              }}
              className="sr-only peer"
            />
            <div
              className={cn(
                "size-3.5 rounded border flex items-center justify-center transition-colors group-hover:border-border/60",
                reduceOnly ? "bg-foreground border-foreground" : "border-border/40 bg-transparent",
              )}
            >
              {reduceOnly && <CheckIcon className="size-2.5 text-background" />}
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Reduce Only
            </span>
          </label>

          <div className="flex flex-col gap-[var(--space-2,0.75rem)]">
            <label className="relative flex items-center gap-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={tpSlEnabled}
                onChange={(e) => {
                  onTpSlEnabledChange(e.target.checked);
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
              <div className="flex flex-col gap-[var(--space-2,0.75rem)] pl-[var(--space-4,1.5rem)]">
                <div className="flex items-center gap-[var(--space-2,0.75rem)]">
                  <div className="flex-1">
                    <label htmlFor="order-form-tp-price" className="sr-only">
                      Take profit price
                    </label>
                    <Input
                      id="order-form-tp-price"
                      type="number"
                      value={tpPrice}
                      onChange={(e) => {
                        onTpPriceChange(e.target.value);
                      }}
                      placeholder="TP Price"
                      className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
                    />
                  </div>
                  <div className="flex items-center gap-[var(--space-1,0.3125rem)]">
                    <label htmlFor="order-form-tp-gain" className="sr-only">
                      Take profit gain percent
                    </label>
                    <Input
                      id="order-form-tp-gain"
                      type="number"
                      value={tpPercent}
                      onChange={(e) => {
                        onTpPercentChange(e.target.value);
                      }}
                      placeholder="Gain"
                      className="w-20 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40"
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-[var(--space-2,0.75rem)]">
                  <div className="flex-1">
                    <label htmlFor="order-form-sl-price" className="sr-only">
                      Stop loss price
                    </label>
                    <Input
                      id="order-form-sl-price"
                      type="number"
                      value={slPrice}
                      onChange={(e) => {
                        onSlPriceChange(e.target.value);
                      }}
                      placeholder="SL Price"
                      className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/70 border-border/40"
                    />
                  </div>
                  <div className="flex items-center gap-[var(--space-1,0.3125rem)]">
                    <label htmlFor="order-form-sl-loss" className="sr-only">
                      Stop loss percent
                    </label>
                    <Input
                      id="order-form-sl-loss"
                      type="number"
                      value={slPercent}
                      onChange={(e) => {
                        onSlPercentChange(e.target.value);
                      }}
                      placeholder="Loss"
                      className="w-20 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/70 border-border/40"
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-[var(--space-3,1.125rem)]">{footer}</div>
      </div>
    </fieldset>
  );
}
