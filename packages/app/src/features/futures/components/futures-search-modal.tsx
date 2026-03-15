import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils/cn";
import { useFuturesList, type FuturesAsset } from "@/hooks/use-futures-list";
import { Skeleton } from "@/components/ui/skeleton";

interface FuturesSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function FuturesSearchModal({ open, onClose }: FuturesSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: futures, isLoading } = useFuturesList();

  const filteredFutures = useMemo(() => {
    if (!futures || !query) return futures || [];
    const q = query.toLowerCase();
    return futures.filter((f) => f.coin.toLowerCase().includes(q));
  }, [futures, query]);

  const handleSelect = (symbol: string) => {
    navigate(`/futures/${symbol.toLowerCase()}`);
    setQuery("");
    onClose();
  };

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search futures..."
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
          />
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-2 space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredFutures.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No futures found</div>
          ) : (
            <div className="p-1">
              {filteredFutures.map((item) => (
                <button
                  key={item.coin}
                  onClick={() => handleSelect(item.coin)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="font-mono font-medium">{item.coin}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{Number(item.openInterest).toFixed(0)} OI</span>
                    <span className={cn(Number(item.funding) >= 0 ? "text-gain" : "text-loss")}>
                      {Number(item.funding) * 100}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
