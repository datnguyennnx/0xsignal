import { useUserBalances } from "../hooks/use-user-balances";
import { BalanceTable } from "./balance-table";

/**
 * Wrapper for the Balances tab content.
 * Internally calls useUserBalances() instead of receiving data via props
 * from a shared parent state blob.
 */
export function BalancesTab() {
  const {
    isChLoading,
    marginSummary,
    positions,
    usdcTotalBalance,
    usdcAvailableBalance,
    totalUnrealizedPnl,
    effectiveAccountTotal,
    effectiveAvailableBalance,
  } = useUserBalances();

  return (
    <BalanceTable
      isChLoading={isChLoading}
      marginSummary={marginSummary}
      positions={positions}
      usdcTotalBalance={usdcTotalBalance}
      usdcAvailableBalance={usdcAvailableBalance}
      totalUnrealizedPnl={totalUnrealizedPnl}
      effectiveAccountTotal={effectiveAccountTotal}
      effectiveAvailableBalance={effectiveAvailableBalance}
    />
  );
}
