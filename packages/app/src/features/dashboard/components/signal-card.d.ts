import type { AssetAnalysis } from "@0xsignal/shared";
interface SignalCardProps {
  readonly signal: AssetAnalysis;
  readonly type: "buy" | "sell" | "hold";
}
export declare function SignalCard({
  signal,
  type,
}: SignalCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=signal-card.d.ts.map
