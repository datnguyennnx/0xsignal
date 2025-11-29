import type { AssetAnalysis } from "@0xsignal/shared";
type SignalType = "buy" | "sell" | "hold";
interface SignalTableProps {
  signals: AssetAnalysis[];
  type: SignalType;
}
export declare function SignalTable({
  signals,
  type,
}: SignalTableProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=signal-table.d.ts.map
