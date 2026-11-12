import { memo } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DEFAULT_INTERVALS, ALL_INTERVALS } from "../utils/constants";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface ChartHeaderProps {
  interval: string;
  onIntervalChange: (interval: string) => void;
  children?: React.ReactNode;
}

const NON_DEFAULT_INTERVALS = ALL_INTERVALS.filter(
  (int) => !DEFAULT_INTERVALS.some((d) => d.value === int.value),
);

export const ChartHeader = memo(function ChartHeader({
  interval,
  onIntervalChange,
  children,
}: ChartHeaderProps) {
  const isDefaultInterval = DEFAULT_INTERVALS.some((int) => int.value === interval);

  function handleIntervalChange(newInterval: string) {
    if (newInterval !== interval) {
      onIntervalChange(newInterval);
    }
  }

  return (
    <div
      data-dense
      className="row-actions justify-between overflow-x-auto scrollbar-hide py-0.5 -my-0.5"
    >
      <div className="row-actions shrink-0">
        {DEFAULT_INTERVALS.map((int) => (
          <Button
            key={int.value}
            variant="ghost"
            onClick={() => {
              handleIntervalChange(int.value);
            }}
            className={cn(
              "relative rounded-control border tabular-nums tracking-[0.01em] press focus-ring transition-[background-color,border-color,color,box-shadow] duration-(--duration-fast)",
              interval === int.value
                ? "border-(--control-active-rim) bg-(--control-active-bg) text-foreground"
                : "border-transparent text-muted-foreground hover:bg-(--control-hover-bg) hover:text-foreground",
            )}
          >
            {int.label}
          </Button>
        ))}
        {NON_DEFAULT_INTERVALS.length > 0 && (
          <NativeSelect
            aria-label="More intervals"
            value={isDefaultInterval ? "" : interval}
            onChange={(e) => {
              if (e.target.value) handleIntervalChange(e.target.value);
            }}
            wrapperClassName="w-24"
            className={cn(
              "cursor-pointer transition-[background-color,border-color,color,box-shadow]",
              isDefaultInterval
                ? "text-muted-foreground hover:text-foreground"
                : "border-(--control-active-rim) bg-(--control-active-bg) text-foreground",
            )}
          >
            {isDefaultInterval && (
              <NativeSelectOption value="" disabled>
                More
              </NativeSelectOption>
            )}
            {NON_DEFAULT_INTERVALS.map((int) => (
              <NativeSelectOption key={int.value} value={int.value}>
                {int.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>
      <div className="row-actions">{children}</div>
    </div>
  );
});
