import { memo } from "react";
import { TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatCompactUsd } from "@/core/utils/formatters";
import { useOwnAddress, useWhaleAddress } from "@/hooks/use-effective-address";
import { useAppStore } from "@/stores/use-app-store";

import { c, cNum } from "../utils/orderbook-table-classes";
import {
  PnLDisplay,
  PosDirLabel,
  TableEmptyRow,
  resolveRowStatus,
} from "./shared-table-components";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { POSITIONS_EMPTY_COPY } from "./balance-table-model";

/** The positions area's one connect affordance; every empty state renders it. */
export function PositionsConnectAction({ context }: { context: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        useAppStore.getState().openConnectWallet(context);
      }}
    >
      Connect Wallet
    </Button>
  );
}

export interface BalanceTableBodyProps {
  isChLoading: boolean;
  isChError?: boolean | undefined;
  onRetry?: (() => void) | undefined;
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

const SummaryRow = memo(function SummaryRow({
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
});

export const BalanceTableBody = memo(function BalanceTableBody({
  isChLoading,
  isChError = false,
  onRetry,
  marginSummary,
  positions,
  usdcTotalBalance,
  usdcAvailableBalance,
  totalUnrealizedPnl,
  effectiveAccountTotal,
  effectiveAvailableBalance,
  onSelectCoin,
}: BalanceTableBodyProps) {
  const ownAddress = useOwnAddress();
  const whaleAddress = useWhaleAddress();
  const needsWallet = ownAddress === undefined && whaleAddress === undefined;

  const hasSummary = marginSummary !== null && marginSummary !== undefined;
  const state = resolveRowStatus({
    isLoading: isChLoading,
    isError: isChError,
    rowCount: hasSummary ? 1 : 0,
  });

  if (!hasSummary || state !== "ready") {
    if (needsWallet && state === "empty") {
      return (
        <TableBody className="wallet-empty">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-6">
              <EmptyState
                {...POSITIONS_EMPTY_COPY}
                className="min-h-0"
                action={<PositionsConnectAction context="trade-position-management" />}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    return (
      <TableBody>
        <TableEmptyRow
          colSpan={6}
          status={state}
          rows={2}
          onRetry={onRetry}
          emptyTitle="No balances for this account"
          errorTitle="Couldn't load balances"
          errorDescription="The balances request failed. Check your connection and try again."
        />
      </TableBody>
    );
  }

  return (
    <TableBody>
      <SummaryRow
        label={QUOTE_ASSET}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="auto"
                  onClick={() => {
                    onSelectCoin?.(position.coin);
                  }}
                  className="relative flex w-full items-center justify-start overflow-hidden -mx-1 text-left font-medium hover:bg-transparent active:scale-100"
                >
                  <span className="relative z-10">{position.coin}</span>
                </Button>
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
});
