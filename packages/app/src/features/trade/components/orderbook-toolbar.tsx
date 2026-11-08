import { memo } from "react";
import { parseSymbol } from "@0xsignal/shared";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TickSizeOption } from "../hooks/use-hyperliquid-orderbook";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";

interface OrderbookToolbarProps {
  symbol: string;
  pairFocus: string;
  onPairFocusChange: (focus: string) => void;
  currentNSigFigs: number | null;
  onNSigFigsChange: (nSigFigs: number) => void;
  scalingOptions: TickSizeOption[];
}

export const OrderbookToolbar = memo(
  ({
    symbol,
    pairFocus,
    onPairFocusChange,
    currentNSigFigs,
    onNSigFigsChange,
    scalingOptions,
  }: OrderbookToolbarProps) => {
    const parsed = parseSymbol(symbol);
    const base = parsed.coin.toUpperCase();
    const quote = parsed.kind === "spot" ? (parsed.quote ?? QUOTE_ASSET) : QUOTE_ASSET;
    const coinOptions = [
      { value: "base", label: base },
      { value: "quote", label: quote },
    ];

    return (
      <div data-dense className="flex items-center justify-between gap-inline shrink-0">
        <NativeSelect
          aria-label="Coin"
          value={pairFocus}
          onChange={(e) => {
            onPairFocusChange(e.target.value);
          }}
          wrapperClassName="min-w-[clamp(4rem,5vw,6rem)] max-w-[clamp(6rem,8vw,10rem)]"
          className="font-semibold"
        >
          {coinOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Price precision"
          value={String(currentNSigFigs ?? 0)}
          onChange={(e) => {
            onNSigFigsChange(Number(e.target.value));
          }}
          wrapperClassName="min-w-fit"
        >
          {scalingOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  },
  (prev, next) =>
    prev.pairFocus === next.pairFocus && prev.currentNSigFigs === next.currentNSigFigs,
);

OrderbookToolbar.displayName = "OrderbookToolbar";
