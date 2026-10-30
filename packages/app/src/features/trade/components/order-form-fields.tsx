import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { formatCompactUsd } from "@/core/utils/formatters";
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
                : "border-transparent text-muted-foreground hover:text-foreground/80",
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
          <Toggle
            pressed={side === "buy"}
            onPressedChange={() => {
              onSideChange("buy");
            }}
            size="sm"
            className="relative z-10 h-full min-w-0 flex-1 cursor-pointer rounded-[0.3125rem] px-0 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 hover:bg-transparent aria-pressed:bg-transparent active:brightness-90"
          >
            <span className={side === "buy" ? "text-primary-foreground" : "text-muted-foreground"}>
              Buy / Long
            </span>
          </Toggle>
          <Toggle
            pressed={side === "sell"}
            onPressedChange={() => {
              onSideChange("sell");
            }}
            size="sm"
            className="relative z-10 h-full min-w-0 flex-1 cursor-pointer rounded-[0.3125rem] px-0 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 hover:bg-transparent aria-pressed:bg-transparent active:brightness-90"
          >
            <span className={side === "sell" ? "text-primary-foreground" : "text-muted-foreground"}>
              Sell / Short
            </span>
          </Toggle>
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
              className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/80 border-border/40"
              aria-invalid={priceInvalid}
            />
          </div>
        )}

        <div className="flex flex-col gap-[var(--space-2,0.75rem)] mt-[var(--space-4,1.5rem)]">
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
                      className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/80 border-border/40"
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
                      className="w-20 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/80 border-border/40"
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
                      className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm tabular-nums bg-background/80 border-border/40"
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
                      className="w-20 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/80 border-border/40"
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
