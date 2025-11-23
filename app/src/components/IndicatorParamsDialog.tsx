import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { IndicatorConfig } from "../types/indicators";

interface IndicatorParamsDialogProps {
  indicator: IndicatorConfig;
  onConfirm: (params: Record<string, number>) => void;
  onCancel: () => void;
}

// Common presets for quick selection
const COMMON_PERIODS = [7, 14, 20, 50, 100, 200];

export function IndicatorParamsDialog({
  indicator,
  onConfirm,
  onCancel,
}: IndicatorParamsDialogProps) {
  const [params, setParams] = useState(indicator.defaultParams || {});
  const hasPeriod = "period" in params;

  const handleQuickAdd = (period: number) => {
    if (hasPeriod) {
      onConfirm({ ...params, period });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(params);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="bg-card border border-border rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">{indicator.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{indicator.description}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-muted rounded transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Quick Presets for Period */}
            {hasPeriod && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Quick Add</label>
                <div className="grid grid-cols-3 gap-2">
                  {COMMON_PERIODS.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handleQuickAdd(period)}
                      className="px-3 py-2 text-sm font-medium rounded border border-border hover:bg-muted hover:border-primary transition-colors"
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {hasPeriod && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or custom</span>
                </div>
              </div>
            )}

            {/* Custom Parameters Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {Object.entries(params).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium capitalize">{key}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setParams({ ...params, [key]: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    min="1"
                    step="1"
                    placeholder={`Enter ${key}`}
                  />
                </div>
              ))}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
