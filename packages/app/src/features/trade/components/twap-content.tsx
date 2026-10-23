import { useState } from "react";
import { cn } from "cn";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { CELL_HEAD_CLASS, CELL_HEAD_NUM_CLASS } from "../utils/orderbook-table-classes";

type TwapSubTab = "active" | "history" | "fill-history";

const TWAP_SUB_TABS: { value: TwapSubTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "history", label: "History" },
  { value: "fill-history", label: "Fill History" },
];

const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/**
 * The three TWAP tables are intentional scaffolds: the TWAP feature has no
 * backend yet, so each renders the correct empty state rather than live rows.
 */
function TwapActiveTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Executed Size</TableHead>
          <TableHead className={cHeadNum}>Average Price</TableHead>
          <TableHead className={cHead}>Running Time / Total</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Creation Time</TableHead>
          <TableHead className={cHead}>Terminate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmptyRow colSpan={8} />
      </TableBody>
    </Table>
  );
}

function TwapHistoryTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHeadNum}>Total Size</TableHead>
          <TableHead className={cHeadNum}>Executed Size</TableHead>
          <TableHead className={cHeadNum}>Average Price</TableHead>
          <TableHead className={cHead}>Total Runtime</TableHead>
          <TableHead className={cHead}>Reduce Only</TableHead>
          <TableHead className={cHead}>Randomize</TableHead>
          <TableHead className={cHead}>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmptyRow colSpan={9} />
      </TableBody>
    </Table>
  );
}

function TwapFillHistoryTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cHead}>Time</TableHead>
          <TableHead className={cHead}>Coin</TableHead>
          <TableHead className={cHead}>Direction</TableHead>
          <TableHead className={cHeadNum}>Price</TableHead>
          <TableHead className={cHeadNum}>Size</TableHead>
          <TableHead className={cHeadNum}>Trade Value</TableHead>
          <TableHead className={cHeadNum}>Fee</TableHead>
          <TableHead className={cHeadNum}>Closed PNL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmptyRow colSpan={8} />
      </TableBody>
    </Table>
  );
}

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
              onClick={() => {
                setTwapSubTab(sub.value);
              }}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
                twapSubTab === sub.value
                  ? "text-foreground bg-foreground/5"
                  : "text-muted-foreground hover:text-foreground",
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
