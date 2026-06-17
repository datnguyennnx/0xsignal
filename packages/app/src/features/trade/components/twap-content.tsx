import { useState } from "react";
import { cn } from "@/core/utils/cn";
import { TwapActiveTable } from "./twap-active-table";
import { TwapHistoryTable } from "./twap-history-table";
import { TwapFillHistoryTable } from "./twap-fill-history-table";

type TwapSubTab = "active" | "history" | "fill-history";

const TWAP_SUB_TABS: { value: TwapSubTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "history", label: "History" },
  { value: "fill-history", label: "Fill History" },
];

/**
 * Renders the TWAP sub-tab navigation and active content.
 * Extracted from position-management.tsx to encapsulate
 * the sub-tab state and rendering logic.
 */
export function TwapContent() {
  const [twapSubTab, setTwapSubTab] = useState<TwapSubTab>("active");

  return (
    <>
      <div className="shrink-0 pt-1.5">
        <div className="flex items-center gap-1">
          {TWAP_SUB_TABS.map((sub) => (
            <button
              key={sub.value}
              onClick={() => setTwapSubTab(sub.value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
                twapSubTab === sub.value
                  ? "text-foreground bg-foreground/5"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
              type="button"
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>
      {twapSubTab === "active" && <TwapActiveTable />}
      {twapSubTab === "history" && <TwapHistoryTable />}
      {twapSubTab === "fill-history" && <TwapFillHistoryTable />}
    </>
  );
}
