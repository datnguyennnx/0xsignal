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
      {/* The row owns the stacking context; the two paint layers sit behind its text. */}
      {isInRange && (
        <div className="absolute inset-0 -z-10 pointer-events-none bg-foreground/5 dark:bg-foreground/10" />
      )}
      {price > 0 && (
        <div
          className={`absolute inset-y-0 right-0 -z-10 opacity-30 dark:opacity-20 pointer-events-none ${
            side === "bid" ? "bg-gain" : "bg-loss"
          }`}
          style={depthStyle}
        />
      )}
      <span
        className={`flex-1 type-data font-medium tabular-nums ${
          price === 0 ? "text-muted-foreground" : side === "bid" ? "text-data-up" : "text-data-down"
        }`}
      >
        {formatted.formattedPrice}
      </span>
      <span className="flex-1 text-right type-data tabular-nums text-muted-foreground">
        {formatted.formattedSize}
      </span>
      <span className="flex-1 text-right type-data tabular-nums text-muted-foreground">
        {formatted.formattedTotal}
      </span>
    </>
  );
}
