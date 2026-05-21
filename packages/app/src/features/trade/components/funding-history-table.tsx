/**
 * Funding History Table — displays historical funding rate payments.
 * Extracted as a shared component for use in both Portfolio and PositionManagement.
 */
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserFunding } from "@/features/portfolio/hooks/use-portfolio-data";
import { formatTime } from "@/features/trade/components/shared-table-utils";
import { formatCompactUsd } from "@/core/utils/formatters";
import {
  CELL_CLASS,
  CELL_NUM_CLASS,
  CELL_HEAD_CLASS,
  CELL_HEAD_NUM_CLASS,
} from "@/features/trade/components/orderbook-table-classes";

/* ─── Styling constants ─── */

const c = CELL_CLASS;
const cNum = CELL_NUM_CLASS;
const cHead = CELL_HEAD_CLASS;
const cHeadNum = CELL_HEAD_NUM_CLASS;

/* ─── Component ─── */

export function FundingHistoryTable() {
  const { data: funding, isLoading, isError } = useUserFunding();

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cHead}>Time</TableHead>
            <TableHead className={cHead}>Coin</TableHead>
            <TableHead className={cHeadNum}>USDC</TableHead>
            <TableHead className={cHeadNum}>Size</TableHead>
            <TableHead className={cHeadNum}>Rate</TableHead>
            <TableHead className={cHeadNum}>Samples</TableHead>
            <TableHead className={cHead}>Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-28 rounded-sm" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-16 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={cNum}>
                  <Skeleton className="h-3 w-12 rounded-sm ml-auto" />
                </TableCell>
                <TableCell className={c}>
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </TableCell>
              </TableRow>
            ))
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6">
                <span className="text-sm text-muted-foreground/50 uppercase tracking-wider font-mono">
                  Unable to load funding history
                </span>
              </TableCell>
            </TableRow>
          ) : !funding || funding.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6">
                <span className="text-sm text-muted-foreground/50 uppercase tracking-wider font-mono">
                  No funding history
                </span>
              </TableCell>
            </TableRow>
          ) : (
            funding.map((entry) => {
              const usdc = Number(entry.delta.usdc);
              return (
                <TableRow key={entry.hash}>
                  <TableCell className={c}>{formatTime(entry.time)}</TableCell>
                  <TableCell className={`${c} font-medium`}>{entry.delta.coin}</TableCell>
                  <TableCell className={`${cNum} ${usdc >= 0 ? "text-gain" : "text-loss"}`}>
                    {formatCompactUsd(Math.abs(usdc))}
                  </TableCell>
                  <TableCell className={cNum}>{entry.delta.szi}</TableCell>
                  <TableCell className={cNum}>
                    {(Number(entry.delta.fundingRate) * 100).toFixed(6)}%
                  </TableCell>
                  <TableCell className={cNum}>{entry.delta.nSamples}</TableCell>
                  <TableCell className={`${c} font-mono text-xs`}>
                    {entry.hash.slice(0, 10)}...
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
