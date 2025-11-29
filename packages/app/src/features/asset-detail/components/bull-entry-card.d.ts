interface BullEntryCardProps {
  isOptimalEntry: boolean;
  strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  className?: string;
}
export declare function BullEntryCard({
  isOptimalEntry,
  strength,
  entryPrice,
  targetPrice,
  stopLoss,
  confidence,
  className,
}: BullEntryCardProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=bull-entry-card.d.ts.map
