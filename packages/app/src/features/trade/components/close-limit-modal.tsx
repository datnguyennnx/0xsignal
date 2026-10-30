import { useState, useCallback, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "cn";
import { formatOrderSize } from "../utils/trade-math";

interface CloseLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    coin: string;
    sz: number;
    isLong: boolean;
    markPx: number;
  } | null;
  szDecimals: number;
  onConfirmLimitClose: (params: { price: string; size: string }) => void;
  isPending: boolean;
}

export function CloseLimitModal({
  isOpen,
  onClose,
  position,
  szDecimals,
  onConfirmLimitClose,
  isPending,
}: CloseLimitModalProps) {
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [sliderPercent, setSliderPercent] = useState(0);

  const handleSliderChange = useCallback(
    (value: number | readonly number[]) => {
      const pct = typeof value === "number" ? value : (value[0] ?? 0);
      setSliderPercent(pct);
      if (position) {
        const rawSize = (pct / 100) * position.sz;
        setSize(formatOrderSize(rawSize, szDecimals));
      }
    },
    [position, szDecimals],
  );

  const handleSizeChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSize(val);
      if (position && Number(val) > 0) {
        const pct = Math.min(100, Math.round((Number(val) / position.sz) * 100));
        setSliderPercent(pct);
      } else {
        setSliderPercent(0);
      }
    },
    [position],
  );

  const handleConfirm = useCallback(() => {
    onConfirmLimitClose({ price, size });
  }, [onConfirmLimitClose, price, size]);

  const canConfirm = Boolean(price && Number(price) > 0 && size && Number(size) > 0);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setPrice("");
          setSize("");
          setSliderPercent(0);
        }
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          MODAL_CONTENT_CLASS,
          "sm:max-w-[clamp(20rem,40vw,26.25rem)] p-5 gap-[clamp(0.5rem,1vw,1rem)]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-foreground">Limit Close</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            This will send an order to close your position at the limit price.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
              Price (USDC)
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                }}
                placeholder="0.00"
                className="h-9 text-base sm:text-sm tabular-nums bg-background/80 border-border/40 pr-14"
              />
              <Button
                type="button"
                variant="link"
                size="auto"
                onClick={() => {
                  if (position !== null) setPrice(position.markPx.toFixed(2));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[length:var(--control-text-xs)] text-foreground hover:text-foreground/80 hover:no-underline"
              >
                Mid
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
              Size {position ? `(${position.coin})` : ""}
            </Label>
            <Input
              type="number"
              value={size}
              onChange={handleSizeChange}
              placeholder="0.00"
              className="h-9 text-base sm:text-sm tabular-nums bg-background/80 border-border/40"
            />
          </div>

          <Slider
            value={[sliderPercent]}
            onValueChange={handleSliderChange}
            min={0}
            max={100}
            step={1}
            className="[&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-ring/40 [&_[data-slot=slider-track]]:hover:bg-muted/40 [&_[data-slot=slider-range]]:hover:brightness-110"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Closing</span>
              <span className="text-xs tabular-nums text-foreground">
                {size && Number(size) > 0 ? `${size} ${position?.coin ?? ""}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Direction</span>
              <span className="text-xs tabular-nums">
                {position ? (position.isLong ? "Close Long" : "Close Short") : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
            className="w-full h-10 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors"
          >
            {isPending ? "Closing..." : "Close position"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
