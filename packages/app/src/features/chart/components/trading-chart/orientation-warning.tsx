import { memo } from "react";
import { RotateCcw } from "lucide-react";

export const OrientationWarning = memo(function OrientationWarning() {
  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-99998 p-6">
      <RotateCcw className="w-12 h-12 text-muted-foreground mb-4 animate-pulse" />
      <h3 className="text-lg font-semibold mb-2">Rotate Your Device</h3>
      <p className="text-sm text-muted-foreground text-center max-w-[280px]">
        For the best chart experience, please rotate your device to landscape mode.
      </p>
    </div>
  );
});
