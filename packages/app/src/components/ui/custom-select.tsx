/**
 * @overview CustomSelect — minimal, flat, borderless dropdown
 *
 * Matches Hyperliquid's dense inline dropdown style.
 * Dark background, compact padding, no visible border until hover.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/core/utils/cn";
import { ChevronDownIcon } from "lucide-react";

export interface CustomSelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface CustomSelectProps<T extends string> {
  readonly options: readonly CustomSelectOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly className?: string;
}

export function CustomSelect<T extends string>({
  options,
  value,
  onChange,
  className,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const handleToggle = useCallback(() => setOpen((p) => !p), []);

  const handleSelect = useCallback(
    (v: T) => {
      onChange(v);
      setOpen(false);
    },
    [onChange]
  );

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 text-[0.6rem] font-medium leading-none",
          "bg-muted/20 hover:bg-muted/40 rounded transition-colors",
          "text-muted-foreground hover:text-foreground"
        )}
      >
        {selected?.label ?? value}
        <ChevronDownIcon className={cn("size-2.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-1 min-w-[5rem]",
            "bg-card border border-border/50 rounded-md shadow-lg overflow-hidden"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[0.65rem] leading-none transition-colors",
                opt.value === value
                  ? "text-foreground bg-accent/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
