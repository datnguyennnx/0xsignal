import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableEmptyRow } from "@/components/table-empty-row";
import { FillHistoryTableHeader } from "./shared-table-components";
import { CELL_HEAD_CLASS, CELL_HEAD_NUM_CLASS } from "../utils/orderbook-table-classes";

type TwapSubTab = "active" | "history" | "fill-history";

const TWAP_SUB_TABS: { value: TwapSubTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "history", label: "History" },
  { value: "fill-history", label: "Fill History" },
];

function isTwapSubTab(value: unknown): value is TwapSubTab {
  return value === "active" || value === "history" || value === "fill-history";
}

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
        <TableEmptyRow
          colSpan={8}
          status="empty"
          emptyTitle="No active TWAP orders — create one to see it here"
        />
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
          <TableHead className={`${cHead} font-medium`}>Coin</TableHead>
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
        <TableEmptyRow colSpan={9} status="empty" emptyTitle="No TWAP order history yet" />
      </TableBody>
    </Table>
  );
}

function TwapFillHistoryTable() {
  return (
    <Table>
      <FillHistoryTableHeader />
      <TableBody>
        <TableEmptyRow
          colSpan={8}
          status="empty"
          emptyTitle="No TWAP fills yet — executions will appear here"
        />
      </TableBody>
    </Table>
  );
}

/**
 * Renders the TWAP sub-tab navigation and active content.
 * Extracted from position-management.tsx to encapsulate
 * the sub-tab state and rendering logic.
 */
export function TwapContent({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [twapSubTab, setTwapSubTab] = useState<TwapSubTab>("active");

  if (readOnly) {
    return (
      <p className="type-body text-muted-foreground">
        TWAP orders aren&apos;t available for public accounts.
      </p>
    );
  }

  return (
    <Tabs
      value={twapSubTab}
      onValueChange={(value) => {
        if (isTwapSubTab(value)) setTwapSubTab(value);
      }}
    >
      <div className="shrink-0 pt-1.5">
        <TabsList variant="line" className="w-fit gap-1">
          {TWAP_SUB_TABS.map((sub) => (
            <TabsTrigger
              key={sub.value}
              value={sub.value}
              variant="text"
              data-dense
              className="type-control"
            >
              {sub.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="active">
        <TwapActiveTable />
      </TabsContent>
      <TabsContent value="history">
        <TwapHistoryTable />
      </TabsContent>
      <TabsContent value="fill-history">
        <TwapFillHistoryTable />
      </TabsContent>
    </Tabs>
  );
}
