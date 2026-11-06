import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { TableEmptyRow } from "@/components/table-empty-row";
import { formatCompactUsd } from "@/core/utils/formatters";

import { c, cNum } from "../utils/orderbook-table-classes";
import { PnLDisplay, PosDirLabel, TableSkeletonRows } from "./shared-table-components";

export interface BalanceTableBodyProps {
  isChLoading: boolean;
  marginSummary?:
    | {
        accountValue: string;
        totalNtlPos: string;
        totalRawUsd: string;
        totalMarginUsed: string;
      }
    | null
    | undefined;
  positions: Array<{
    position: {
      coin: string;
      szi: string;
      positionValue: string;
      unrealizedPnl: string;
      returnOnEquity: string;
    };
  }>;
  usdcTotalBalance: number;
  usdcAvailableBalance: number;
  totalUnrealizedPnl: number;
  effectiveAccountTotal: number;
  effectiveAvailableBalance: number;
  /** When set, a coin click is taken over here instead of doing nothing. */
  onSelectCoin?: ((coin: string) => void) | undefined;
}

function SummaryRow({
  label,
  value,
  pnl,
  total,
  available,
}: {
  label: string;
  value: number;
  pnl: number;
  total: number;
  available: number;
}) {
  return (
    <TableRow>
      <TableCell className={`${c} font-medium`}>{label}</TableCell>
      <TableCell className={c}>—</TableCell>
      <TableCell className={cNum}>{formatCompactUsd(value)}</TableCell>
      <TableCell className={cNum}>
        {pnl === 0 ? (
          "—"
        ) : (
          <span className={pnl >= 0 ? "text-gain" : "text-loss"}>{formatCompactUsd(pnl)}</span>
        )}
      </TableCell>
      <TableCell className={cNum}>{formatCompactUsd(total)}</TableCell>
      <TableCell className={cNum}>{formatCompactUsd(available)}</TableCell>
    </TableRow>
  );
}

export function BalanceTableBody({
  isChLoading,
  marginSummary,
  positions,
  usdcTotalBalance,
  usdcAvailableBalance,
  totalUnrealizedPnl,
  effectiveAccountTotal,
  effectiveAvailableBalance,
  onSelectCoin,
}: BalanceTableBodyProps) {
  if (isChLoading) {
    return (
      <TableBody>
        <TableSkeletonRows rows={2} colSpan={6} />
      </TableBody>
    );
  }

  if (!marginSummary) {
    return (
      <TableBody>
        <TableEmptyRow colSpan={6} />
      </TableBody>
    );
  }

  return (
    <TableBody>
      <SummaryRow
        label="USDC"
        value={usdcTotalBalance}
        pnl={totalUnrealizedPnl}
        total={usdcTotalBalance}
        available={usdcAvailableBalance}
      />
      <SummaryRow
        label="Account"
        value={Number(marginSummary.accountValue)}
        pnl={totalUnrealizedPnl}
        total={effectiveAccountTotal}
        available={effectiveAvailableBalance}
      />

      {positions.map(({ position }) => {
        const posValue = Number(position.positionValue);
        const upnl = Number(position.unrealizedPnl);
        const roe = Number(position.returnOnEquity) * 100;
        return (
          <TableRow key={position.coin}>
            <TableCell className={`${c} font-medium`}>
              {onSelectCoin === undefined ? (
                position.coin
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCoin?.(position.coin);
                  }}
                  className="relative overflow-hidden flex items-center w-full text-left cursor-pointer transition-colors hover:text-foreground rounded px-1 -mx-1"
                >
                  <span className="relative z-10">{position.coin}</span>
                </button>
              )}
            </TableCell>
            <TableCell className={c}>
              <PosDirLabel szi={position.szi} />
            </TableCell>
            <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
            <TableCell className={cNum}>
              {upnl === 0 ? "—" : <PnLDisplay usd={upnl} pct={roe} />}
            </TableCell>
            <TableCell className={cNum}>{formatCompactUsd(posValue + upnl)}</TableCell>
            <TableCell className={cNum}>—</TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
}
