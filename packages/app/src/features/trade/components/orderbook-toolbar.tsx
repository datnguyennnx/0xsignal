import { memo } from "react";
import { parseSymbol } from "@0xsignal/shared";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { TickSizeOption } from "../hooks/use-hyperliquid-orderbook";

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
    const quote = parsed.kind === "spot" ? (parsed.quote ?? "USDC") : "USDC";
    const coinOptions = [
      { value: "base", label: base },
      { value: "quote", label: quote },
    ];

    return (
      <div className="flex items-center justify-between gap-[var(--space-2,0.75rem)] shrink-0">
        <NativeSelect
          size="sm"
          aria-label="Coin"
          value={pairFocus}
          onChange={(e) => {
            onPairFocusChange(e.target.value);
          }}
          wrapperClassName="min-w-[4rem] max-w-[6rem]"
          className="h-7 w-full min-w-0 text-[length:var(--text-micro)] font-semibold tracking-[0.01em]"
        >
          {coinOptions.map((opt) => (
            <NativeSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Price precision"
          value={String(currentNSigFigs ?? 0)}
          onChange={(e) => {
            onNSigFigsChange(Number(e.target.value));
          }}
          wrapperClassName="min-w-fit"
          className="h-7 w-full min-w-0 text-[length:var(--text-micro)] tracking-[0.01em] hover:bg-muted/40 focus-visible:ring-[2px] focus-visible:ring-ring/40"
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
