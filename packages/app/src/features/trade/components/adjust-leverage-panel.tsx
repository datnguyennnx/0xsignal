import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "cn";
import { AlertTriangleIcon } from "lucide-react";

interface AdjustLeveragePanelProps {
  leverage: number;
  currentLeverage: number;
  maxLeverage: number;
  isCross: boolean;
  isDecreasingLeverage: boolean;
  onSliderCommit: (value: number | readonly number[]) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function AdjustLeveragePanel({
  leverage,
  currentLeverage,
  maxLeverage,
  isCross,
  isDecreasingLeverage,
  onSliderCommit,
  onInputChange,
}: AdjustLeveragePanelProps) {
  const ticks = [
    1,
    Math.round(maxLeverage * 0.25),
    Math.round(maxLeverage * 0.5),
    Math.round(maxLeverage * 0.75),
    Math.round(maxLeverage * 0.9),
    maxLeverage,
  ];

  // Ticks can repeat for low leverage caps; disambiguate with occurrence counts.
  const seenTicks = new Map<number, number>();
  const tickEntries = ticks.map((tick) => {
    const occurrence = (seenTicks.get(tick) ?? 0) + 1;
    seenTicks.set(tick, occurrence);
    return { tick, key: `${tick}x#${occurrence}` };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border/20 bg-muted/40 px-3 py-2">
        <span className="text-[length:var(--text-compact)] text-muted-foreground">Current</span>
        <span className="text-[length:var(--text-compact)] tabular-nums text-foreground">
          {currentLeverage}x — {isCross ? "Cross" : "Isolated"}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-md border border-border/20 bg-muted/40 px-3 py-2">
          <Label
            htmlFor="adjust-leverage-input"
            className="text-[length:var(--text-compact)] font-normal text-muted-foreground"
          >
            Leverage
          </Label>
          <div className="flex items-baseline">
            <Input
              id="adjust-leverage-input"
              type="number"
              min={1}
              max={maxLeverage}
              value={leverage}
              onChange={onInputChange}
              className="h-7 w-14 border-0 bg-transparent p-0 text-right text-lg font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-lg font-semibold tabular-nums text-foreground">x</span>
          </div>
        </div>

        <Slider
          value={[leverage]}
          onValueChange={onSliderCommit}
          min={1}
          max={maxLeverage}
          step={1}
          className="transition-opacity duration-200"
        />

        <div className="relative h-4 text-[length:var(--text-data)] text-muted-foreground">
          {tickEntries.map(({ tick, key }, i) => {
            const isFirst = i === 0;
            const isLast = i === tickEntries.length - 1;
            const pct = maxLeverage > 1 ? ((tick - 1) / (maxLeverage - 1)) * 100 : 0;
            return (
              <span
                key={key}
                className={cn(
                  "absolute tabular-nums",
                  isFirst && "left-0",
                  isLast && "right-0",
                  !isFirst && !isLast && "-translate-x-1/2",
                )}
                style={!isFirst && !isLast ? { left: `${pct}%` } : undefined}
              >
                {tick}x
              </span>
            );
          })}
        </div>
      </div>

      <p className="text-[length:var(--text-data)] text-muted-foreground leading-relaxed">
        Max position size decreases the higher your leverage.
      </p>

      <Alert variant="destructive" className="px-3 py-2.5">
        <AlertTriangleIcon />
        <AlertDescription className="text-[length:var(--text-data)] leading-relaxed">
          {isDecreasingLeverage
            ? "Decreasing leverage requires additional margin. Ensure you have sufficient available balance."
            : "Note that setting a higher leverage increases the risk of liquidation."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
