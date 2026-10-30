import { TableRow, TableCell } from "@/components/ui/table";
import type { UserFundingEntry } from "@0xsignal/shared";
import { formatTime } from "@/features/trade/utils/shared-table-utils";
import { formatCompactUsd, formatFundingPercent, formatSize } from "@/core/utils/formatters";
import { PosDirLabel } from "@/features/trade/components/shared-table-components";
import { c, cNum } from "@/features/trade/utils/orderbook-table-classes";

interface FundingHistoryRowsProps {
  entries: UserFundingEntry[];
}

export function FundingHistoryRows({ entries }: FundingHistoryRowsProps) {
  const seenEntries = new Map<string, number>();

  return (
    <>
      {entries.map((entry) => {
        const usdc = Number(entry.delta.usdc);
        const entryKey = `${entry.hash}-${entry.time}`;
        const occurrence = (seenEntries.get(entryKey) ?? 0) + 1;
        seenEntries.set(entryKey, occurrence);
        return (
          <TableRow key={`${entryKey}#${occurrence}`}>
            <TableCell className={c}>{formatTime(entry.time)}</TableCell>
            <TableCell className={`${c} font-medium`}>{entry.delta.coin}</TableCell>
            <TableCell className={cNum}>{formatSize(Number(entry.delta.szi))}</TableCell>
            <TableCell className={c}>
              <PosDirLabel szi={entry.delta.szi} />
            </TableCell>
            <TableCell className={`${cNum} ${usdc >= 0 ? "text-gain" : "text-loss"}`}>
              {formatCompactUsd(Math.abs(usdc))}
            </TableCell>
            <TableCell className={cNum}>
              {formatFundingPercent(Number(entry.delta.fundingRate))}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
