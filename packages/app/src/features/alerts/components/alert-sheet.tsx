import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/core/utils/formatters";

import { useCreateAlert } from "../hooks/use-alert-mutations";
import { usePricePreview } from "../lib/preview";
import {
  buildSheetRule,
  shiftPriceByPercent,
  type AlertSheetEvent,
  type SheetFormValues,
} from "../lib/rule-build";

import { FullAlertFooter } from "./full-alert-footer";
import { FullAlertForm } from "./full-alert-form";
import { QuickAlertFields } from "./quick-alert-fields";
import { QuickAlertFooter } from "./quick-alert-footer";

export type { AlertSheetEvent };

const RULE_LIMIT = 10;

interface AlertSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSymbol?: string;
  defaultPrice?: number | undefined;
  initialEvent?: AlertSheetEvent;
  variant?: "quick" | "full";
  /** Total rules the account already holds; the budget applies to the quick path. */
  ruleCount?: number;
}

function initialValues(
  defaultSymbol: string | undefined,
  defaultPrice: number | undefined,
  initialEvent: AlertSheetEvent | undefined,
): SheetFormValues {
  return {
    kind: initialEvent === undefined ? "price" : "calendar",
    sentence: "",
    symbol: defaultSymbol?.toUpperCase() ?? "",
    operator: "above",
    value: defaultPrice === undefined ? "" : String(defaultPrice),
    currency: initialEvent === undefined ? "" : initialEvent.currency.toUpperCase(),
    leadMinutes: "15",
    impactMin: initialEvent?.impact === "medium" ? "medium" : "high",
    repeat: "once",
    expiry: "never",
    forSeconds: "0",
    parseHint: null,
  };
}

function deriveSheet(values: SheetFormValues, isQuick: boolean, ruleCount: number) {
  const normalizedSymbol = values.symbol.trim().toUpperCase();
  const normalizedCurrency = values.currency.trim().toUpperCase();
  const numericValue = Number(values.value);
  const hasPrice = values.value.trim() !== "" && Number.isFinite(numericValue) && numericValue > 0;
  const canArmPrice = normalizedSymbol !== "";
  const canArm = values.kind === "price" ? canArmPrice && hasPrice : normalizedCurrency !== "";
  const quickLimitReached = isQuick && ruleCount >= RULE_LIMIT;
  const quickTitle = hasPrice ? `Alert at ${formatPrice(numericValue)}` : "New alert";
  return {
    numericValue,
    hasPrice,
    canArmPrice,
    canArm,
    quickLimitReached,
    quickTitle,
  };
}

export function AlertSheet({
  open,
  onOpenChange,
  defaultSymbol,
  defaultPrice,
  initialEvent,
  variant = "full",
  ruleCount = 0,
}: AlertSheetProps) {
  const createAlert = useCreateAlert();
  const [values, setValues] = useState<SheetFormValues>(() =>
    initialValues(defaultSymbol, defaultPrice, initialEvent),
  );
  const [isQuick, setIsQuick] = useState(variant === "quick");

  const patch = (next: Partial<SheetFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }));
  };

  const { numericValue, hasPrice, canArmPrice, canArm, quickLimitReached, quickTitle } =
    deriveSheet(values, isQuick, ruleCount);

  const adjustPrice = (percent: number) => {
    if (!hasPrice) return;
    patch({ value: String(shiftPriceByPercent(numericValue, percent)) });
  };

  const previewRule = useMemo(
    () =>
      values.kind === "price" && canArmPrice && hasPrice
        ? buildSheetRule(false, values, initialEvent)
        : null,
    [values, canArmPrice, hasPrice, initialEvent],
  );
  const previewCount = usePricePreview(previewRule, open);

  const handleSubmit = () => {
    if (!canArm || quickLimitReached) return;

    createAlert.mutate(buildSheetRule(isQuick, values, initialEvent), {
      onSuccess: () => {
        toast.success("Alert armed");
        setValues(initialValues(defaultSymbol, defaultPrice, initialEvent));
        setIsQuick(variant === "quick");
        onOpenChange(false);
      },
      onError: () => {
        toast.error("Couldn't arm the alert");
      },
    });
  };

  if (isQuick) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent layout="dialog" className="w-[30rem]! max-w-[92vw]">
          <DialogHeader>
            <DialogTitle className="tabular-nums">{quickTitle}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-0">
            <QuickAlertFields
              value={values.value}
              onValueChange={(value) => {
                patch({ value });
              }}
              operator={values.operator}
              onOperatorChange={(operator) => {
                patch({ operator });
              }}
              repeat={values.repeat}
              onRepeatChange={(repeat) => {
                patch({ repeat });
              }}
              canAdjust={hasPrice}
              onAdjust={adjustPrice}
              previewCount={previewCount}
            />
          </DialogBody>

          <QuickAlertFooter
            canArm={canArm}
            isPending={createAlert.isPending}
            limitReached={quickLimitReached}
            onArm={handleSubmit}
            onShowFull={() => {
              setIsQuick(false);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout="dialog" className="w-[30rem]! max-w-[92vw]">
        <DialogHeader>
          <DialogTitle>New alert</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4 space-y-0">
          <FullAlertForm values={values} onChange={patch} previewCount={previewCount} />
        </DialogBody>

        <FullAlertFooter canArm={canArm} isPending={createAlert.isPending} onArm={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
