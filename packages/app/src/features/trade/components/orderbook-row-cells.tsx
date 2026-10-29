import { type CSSProperties } from "react";

interface FormattedRowValues {
  formattedPrice: string;
  formattedSize: string;
  formattedTotal: string;
}

export interface OrderRowCellsProps {
  price: number;
  side: "bid" | "ask";
  isInRange: boolean;
  depthStyle: CSSProperties;
  formatted: FormattedRowValues;
}

/**
 * Returns a fragment rather than a wrapper: the three columns must stay direct
 * children of the row button or the flex-1 alignment breaks.
 */
export function OrderRowCells({
  price,
  side,
  isInRange,
  depthStyle,
  formatted,
}: OrderRowCellsProps) {
  return (
    <>
      {isInRange && (
        <div className="absolute inset-0 z-[5] pointer-events-none bg-foreground/5 dark:bg-foreground/10" />
      )}
      {price > 0 && (
        <div
          className={`absolute inset-y-0 right-0 z-0 opacity-20 pointer-events-none ${
            side === "bid" ? "bg-gain" : "bg-loss"
          }`}
          style={depthStyle}
        />
      )}
      <span
        className={`relative z-10 flex-1 text-[length:var(--text-micro)] font-mono font-medium ${
          price === 0 ? "text-muted-foreground" : side === "bid" ? "text-gain" : "text-loss"
        }`}
      >
        {formatted.formattedPrice}
      </span>
      <span className="relative z-10 flex-1 text-right text-[length:var(--text-micro)] font-mono text-muted-foreground">
        {formatted.formattedSize}
      </span>
      <span className="relative z-10 flex-1 text-right text-[length:var(--text-micro)] font-mono text-muted-foreground">
        {formatted.formattedTotal}
      </span>
    </>
  );
}
