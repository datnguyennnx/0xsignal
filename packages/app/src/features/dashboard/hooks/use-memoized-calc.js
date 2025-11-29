// Signal Categorization - pure function wrapper
// React 19.2 Compiler handles memoization automatically
import { categorizeSignals } from "@/core/utils/effect-memoization";
// Pure function - React Compiler optimizes automatically
export const useMemoizedSignals = (analyses) => categorizeSignals(analyses);
//# sourceMappingURL=use-memoized-calc.js.map
