import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Bot, Loader2, RefreshCw, Zap, Brain } from "lucide-react";
import { cn } from "@/core/utils/cn";
import type { TradeRecommendation, AIError, FrontendProvider, ModelSelection } from "@/services/ai";

// Pure functions outside component - no re-creation on render
const getRecommendationLabel = (rec: string): string => {
  switch (rec) {
    case "buy":
      return "BUY";
    case "sell":
      return "SELL";
    case "hold":
      return "HOLD";
    case "close":
      return "CLOSE";
    default:
      return rec.toUpperCase();
  }
};

const getRecommendationColor = (rec: string): string => {
  switch (rec) {
    case "buy":
      return "bg-gain/20 text-gain";
    case "sell":
      return "bg-loss/20 text-loss";
    case "close":
      return "bg-orange-500/20 text-orange-500";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface AIChatPanelProps {
  readonly symbol: string;
  readonly recommendation: TradeRecommendation | null;
  readonly loading: boolean;
  readonly error: AIError | null;
  readonly hasError: boolean;
  readonly onSendQuery: (query: string) => void;
  readonly onRetry?: () => void;
  readonly providers?: FrontendProvider[];
  readonly selectedModel?: ModelSelection;
  readonly onModelChange?: (model: ModelSelection | undefined) => void;
}

const AIChatPanelComponent = ({
  symbol,
  recommendation,
  loading,
  error,
  hasError,
  onSendQuery,
  onRetry,
  providers,
  selectedModel,
  onModelChange,
}: AIChatPanelProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSendQuery(query.trim());
      setQuery("");
    }
  };

  // Encode model selection as "provider:modelId" for Select value
  const modelValue = selectedModel
    ? `${selectedModel.provider}:${selectedModel.modelId}`
    : undefined;

  const handleModelChange = (value: string) => {
    if (!onModelChange) return;
    const [provider, ...rest] = value.split(":");
    const modelId = rest.join(":"); // Model IDs may contain colons
    onModelChange({
      provider: provider as ModelSelection["provider"],
      modelId,
    });
  };

  return (
    <div className="h-full flex flex-col bg-card border rounded-lg overflow-hidden p-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/20 shrink-0 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>Insight</span>
        </div>
        {providers && providers.length > 0 && onModelChange && (
          <Select value={modelValue} onValueChange={handleModelChange}>
            <SelectTrigger
              size="sm"
              className="w-auto h-6 text-[10px] border-0 bg-muted/50 hover:bg-muted rounded px-2 gap-1"
            >
              <Brain className="w-3 h-3" />
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent align="end">
              {providers.map((provider) => (
                <SelectGroup key={provider.id}>
                  <SelectLabel className="text-[10px]">{provider.name}</SelectLabel>
                  {provider.models.map((model) => (
                    <SelectItem
                      key={`${provider.id}:${model.id}`}
                      value={`${provider.id}:${model.id}`}
                      className="text-[10px]"
                    >
                      <span className="truncate">{model.name}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            </div>
          ) : hasError || error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <div className="p-2 rounded bg-destructive/10 text-destructive text-xs text-center">
                {error?.message || "Failed to analyze"}
              </div>
              {onRetry && (
                <Button variant="ghost" size="icon-sm" onClick={onRetry} className="h-6 w-6">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
            </div>
          ) : recommendation ? (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
              {/* Signal Header */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    getRecommendationColor(recommendation.recommendation)
                  )}
                >
                  {getRecommendationLabel(recommendation.recommendation)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {recommendation.confidence}% CONF
                </span>
              </div>

              {/* Key Levels Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono p-2 bg-muted/20 rounded border border-border/20">
                <div>
                  <span className="text-muted-foreground block mb-0.5 text-[10px]">Entry</span>
                  <div className="text-foreground">
                    ${recommendation.entryZone.min.toFixed(2)} - $
                    {recommendation.entryZone.max.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5 text-[10px]">Stop</span>
                  <div className="text-loss">${recommendation.stopLoss.toFixed(2)}</div>
                </div>
              </div>

              {/* Targets */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                  Targets
                </p>
                <div className="space-y-1">
                  {recommendation.targets.map((target, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-gain">TP{index + 1}</span>
                      <span>${target.price.toFixed(2)}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {target.probability}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analysis Text */}
              <div className="pt-2 border-t border-border/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {recommendation.reasoning}
                </p>
              </div>

              {/* ICT Chips */}
              {recommendation.ictAnalysis && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {recommendation.ictAnalysis.fairValueGap && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20">
                      FVG
                    </span>
                  )}
                  {recommendation.ictAnalysis.orderBlock && (
                    <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] border border-purple-500/20">
                      OB
                    </span>
                  )}
                  {recommendation.ictAnalysis.liquiditySweep && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-[10px] border border-orange-500/20">
                      Sweep
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40">
              <Bot className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-xs text-center max-w-[150px]">Ask AI for analysis on {symbol}</p>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-2 border-t border-border/10 bg-card">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Input
              type="text"
              placeholder="Ask AI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs pr-8 bg-muted/20 border-border/20 focus-visible:ring-1 focus-visible:ring-primary/20"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon-sm"
              className="absolute right-1 h-6 w-6 text-muted-foreground hover:text-foreground"
              disabled={!query.trim() || loading}
              variant="ghost"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const AIChatPanel = memo(AIChatPanelComponent, (prev, next) => {
  return (
    prev.symbol === next.symbol &&
    prev.loading === next.loading &&
    prev.recommendation === next.recommendation &&
    prev.error === next.error &&
    prev.selectedModel === next.selectedModel
  );
});
