import type { BuybackSignal } from "@0xsignal/shared";
interface BuybackListProps {
  readonly signals: readonly BuybackSignal[];
  readonly onSelect?: (signal: BuybackSignal) => void;
}
export declare function BuybackList({
  signals,
  onSelect,
}: BuybackListProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=buyback-list.d.ts.map
