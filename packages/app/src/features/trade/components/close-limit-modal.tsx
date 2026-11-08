import { useState, useCallback, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
      <DialogContent layout="dialog" className="gap-stack">
        <DialogHeader>
          <DialogTitle>Limit Close</DialogTitle>
          <DialogDescription>
            This will send an order to close your position at the limit price.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-3">
            <Label className="type-label uppercase tracking-wider text-muted-foreground font-normal">
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
                className="tabular-nums"
              />
              <Button
                type="button"
                variant="link"
                size="auto"
                onClick={() => {
                  if (position !== null) setPrice(position.markPx.toFixed(2));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground/80 hover:no-underline"
              >
                Mid
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="type-label uppercase tracking-wider text-muted-foreground font-normal">
              Size {position ? `(${position.coin})` : ""}
            </Label>
            <Input
              type="number"
              value={size}
              onChange={handleSizeChange}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>

          <Slider
            value={[sliderPercent]}
            onValueChange={handleSliderChange}
            min={0}
            max={100}
            step={1}
            className="**:data-[slot=slider-thumb]:hover:ring-4 **:data-[slot=slider-thumb]:hover:ring-ring **:data-[slot=slider-track]:hover:bg-muted/40 **:data-[slot=slider-range]:hover:brightness-110"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="type-label text-muted-foreground">Closing</span>
              <span className="type-data tabular-nums text-foreground">
                {size && Number(size) > 0 ? `${size} ${position?.coin ?? ""}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="type-label text-muted-foreground">Direction</span>
              <span className="type-data tabular-nums">
                {position ? (position.isLong ? "Close Long" : "Close Short") : "—"}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="cta"
          onClick={handleConfirm}
          disabled={!canConfirm || isPending}
          className="w-full"
        >
          {isPending ? "Closing..." : "Close position"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
