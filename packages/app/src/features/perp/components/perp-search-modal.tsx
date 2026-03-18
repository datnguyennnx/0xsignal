import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/utils/cn";
import { usePerpList, type PerpAsset } from "@/hooks/use-perp-list";
import { Skeleton } from "@/components/ui/skeleton";

interface PerpSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export const PerpSearchModal = memo(function PerpSearchModal({
  open,
  onClose,
}: PerpSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = usePerpList();

  const perps = data?.assets;

  const filteredPerps = useMemo(() => {
    if (!perps || !query) return perps || [];
    const q = query.toLowerCase();
    return perps.filter((f) => f.coin.toLowerCase().includes(q));
  }, [perps, query]);

  const handleSelect = useCallback(
    (symbol: string) => {
      navigate(`/perp/${symbol.toLowerCase()}`);
      setQuery("");
      onClose();
    },
    [navigate, onClose]
  );

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
            placeholder="Search perp..."
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
          ) : filteredPerps.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No perp found</div>
          ) : (
            <div className="p-1">
              {filteredPerps.map((item) => (
                <Button
                  key={item.coin}
                  variant="ghost"
                  onClick={() => handleSelect(item.coin)}
                  className="w-full justify-between h-auto py-2.5 px-3 hover:bg-muted/50"
                >
                  <span className="font-mono font-medium">{item.coin}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span
                      className={cn(Number(item.funding) >= 0 ? "text-green-500" : "text-red-500")}
                    >
                      {Number(item.funding) * 100}%
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
