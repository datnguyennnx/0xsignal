import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

import {
  QUICK_DIRECTION_OPTIONS,
  QUICK_STEP_PERCENTS,
  type Operator,
  type RepeatMode,
} from "../lib/rule-build";

import { PreviewLine } from "./preview-line";

interface QuickAlertFieldsProps {
  value: string;
  onValueChange: (value: string) => void;
  operator: Operator;
  onOperatorChange: (operator: Operator) => void;
  repeat: RepeatMode;
  onRepeatChange: (repeat: RepeatMode) => void;
  canAdjust: boolean;
  onAdjust: (percent: number) => void;
  previewCount: number | null | undefined;
}

export function QuickAlertFields({
  value,
  onValueChange,
  operator,
  onOperatorChange,
  repeat,
  onRepeatChange,
  canAdjust,
  onAdjust,
  previewCount,
}: QuickAlertFieldsProps) {
  const priceId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={priceId}>Price</Label>
        <Input
          id={priceId}
          inputMode="decimal"
          value={value}
          autoComplete="off"
          placeholder="100000"
          className="text-right tabular-nums"
          onChange={(event) => {
            onValueChange(event.target.value);
          }}
        />
      </div>

      <Segmented
        aria-label="Price direction"
        options={QUICK_DIRECTION_OPTIONS}
        value={operator}
        sizing="fill"
        onValueChange={onOperatorChange}
      />

      <div className="grid min-w-0 grid-cols-4 gap-1.5">
        {QUICK_STEP_PERCENTS.map((percent) => (
          <Button
            key={percent}
            variant="outline"
            disabled={!canAdjust}
            className="h-control! min-w-0 tabular-nums"
            onClick={() => {
              onAdjust(percent);
            }}
          >
            {percent > 0 ? `+${percent}%` : `${percent}%`}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <Checkbox
          checked={repeat === "repeat"}
          onCheckedChange={(checked) => {
            onRepeatChange(checked ? "repeat" : "once");
          }}
        >
          Repeat every 10 min
        </Checkbox>
        <PreviewLine count={previewCount} />
      </div>
    </div>
  );
}
