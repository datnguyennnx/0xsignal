import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatOrderSize } from "../utils/trade-math";

interface CloseLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Position info needed to construct the order */
  position: {
    coin: string;
    sz: number; // absolute size (positive)
    isLong: boolean;
    markPx: number;
  } | null;
  szDecimals: number;
  /** Called when user confirms — parent handles the mutation */
  onConfirmLimitClose: (params: { price: string; size: string }) => void;
  /** Whether the mutation is pending */
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

  /* ─── Reset state when dialog opens ─── */
  useEffect(() => {
    if (isOpen) {
      setPrice("");
      setSize("");
      setSliderPercent(0);
    }
  }, [isOpen]);

  /* ─── Slider handler: compute size from percentage ─── */
  const handleSliderChange = useCallback(
    (values: number[]) => {
      const pct = values[0] ?? 0;
      setSliderPercent(pct);
      if (position) {
        const rawSize = (pct / 100) * position.sz;
        setSize(formatOrderSize(rawSize, szDecimals));
      }
    },
    [position, szDecimals]
  );

  /* ─── Size input handler: sync slider ─── */
  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSize(val);
      if (position && Number(val) > 0) {
        const pct = Math.min(100, Math.round((Number(val) / position.sz) * 100));
        setSliderPercent(pct);
      } else {
        setSliderPercent(0);
      }
    },
    [position]
  );

  /* ─── Confirm handler ─── */
  const handleConfirm = useCallback(() => {
    onConfirmLimitClose({ price, size });
  }, [onConfirmLimitClose, price, size]);

  const canConfirm = Boolean(price && Number(price) > 0 && size && Number(size) > 0);
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[420px] bg-card border-border/30 p-0 gap-0 overflow-hidden">
        {/* ─── Header ─── */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/20">
          <DialogTitle className="text-sm font-medium text-foreground">Limit Close</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This will send an order to close your position at the limit price.
          </p>
        </DialogHeader>

        {/* ─── Body ─── */}
        <div className="px-5 py-4 space-y-4">
          {/* Price Input */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
              Price (USDC)
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-9 text-xs tabular-nums bg-background/70 border-border/30 pr-14"
              />
              <button
                onClick={() => position && setPrice(position.markPx.toFixed(2))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground hover:text-foreground/70 transition-colors"
              >
                Mid
              </button>
            </div>
          </div>

          {/* Size Input */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-normal">
              Size {position ? `(${position.coin})` : ""}
            </Label>
            <Input
              type="number"
              value={size}
              onChange={handleSizeChange}
              placeholder="0.00"
              className="h-9 text-xs tabular-nums bg-background/70 border-border/30"
            />
          </div>

          {/* Slider */}
          <div className="pt-1">
            <Slider
              value={[sliderPercent]}
              onValueChange={handleSliderChange}
              min={0}
              max={100}
              step={1}
              className="[&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-ring/40 [&_[data-slot=slider-track]]:hover:bg-muted/40 [&_[data-slot=slider-range]]:hover:brightness-110"
            />
          </div>

          {/* Info rows */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Closing</span>
              <span className="text-xs font-mono tabular-nums text-foreground">
                {size && Number(size) > 0 ? `${size} ${position?.coin ?? ""}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Direction</span>
              <span className="text-xs font-mono tabular-nums">
                {position ? (position.isLong ? "Close Long" : "Close Short") : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="px-5 py-3 border-t border-border/20">
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
            className="w-full h-9 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all bg-foreground text-background hover:bg-foreground/90"
          >
            {isPending ? "Confirming..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
