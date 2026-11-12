import { formatCompactUsd, formatSignedPercent, formatSize } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Region } from "@/components/region";
import { cn } from "cn";
import { useAppStore } from "@/stores/use-app-store";
import { useUserBalances } from "../hooks/use-user-balances";
import { FieldRow } from "./shared-table-components";

/** Loaded rows stack with this gap; the skeleton uses it so the height matches. */
const STACK = "flex flex-col gap-1";

/** Loaded rows and skeletons share this box, so both resolve to the same height. */
const ROW = "flex items-center justify-between py-1";

const SKELETON_ROW_KEYS = ["value", "pnl", "ratio", "leverage"];

/** Each block sits in the same line box as the text it replaces. */
function AccountSummarySkeleton() {
  return (
    <div className={STACK}>
      <div className={ROW}>
        <span className="type-label">
          <Skeleton className="h-[1em] w-24" />
        </span>
      </div>
      {SKELETON_ROW_KEYS.map((key) => (
        <div key={key} className={ROW}>
          <span className="type-label">
            <Skeleton className="h-[1em] w-20" />
          </span>
          <span className="type-data">
            <Skeleton className="h-[1em] w-14" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function UnifiedAccountSummary() {
  const { marginSummary, totalUnrealizedPnl, state, refetch } = useUserBalances();

  const resolvedState =
    state.status === "ready" && marginSummary === undefined
      ? ({ status: "empty", reason: "first-use" } as const)
      : state;

  return (
    <Region
      state={resolvedState}
      label="Unified account"
      skeleton={<AccountSummarySkeleton />}
      error={{
        title: "Couldn't load account",
        description: "Check your connection and try again.",
        retry: refetch,
      }}
      empty={{
        title: "No account connected",
        description: "Connect a wallet to see your unified account.",
        action: (
          <Button
            variant="outline"
            onClick={() => {
              useAppStore.getState().openConnectWallet("unified-account-summary");
            }}
          >
            Connect Wallet
          </Button>
        ),
      }}
    >
      {(data) => {
        const summary = data.marginSummary;
        if (summary === undefined) return null;

        const accountValue = Number(summary.accountValue);
        const totalNtlPos = Number(summary.totalNtlPos);
        const totalMarginUsed = Number(summary.totalMarginUsed);

        const accountRatio = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;
        const accountLeverage = accountValue > 0 ? totalNtlPos / accountValue : 0;
        const pnlClass = totalUnrealizedPnl >= 0 ? "text-gain" : "text-loss";

        return (
          <div className={STACK}>
            <div className={ROW}>
              <span className="type-label font-medium uppercase tracking-wider text-muted-foreground">
                Unified Account
              </span>
            </div>

            <FieldRow
              label="Portfolio Value"
              value={formatCompactUsd(accountValue)}
              valueClassName="type-data tabular-nums text-foreground"
            />

            <FieldRow
              label="Unrealized PNL"
              value={formatCompactUsd(totalUnrealizedPnl)}
              valueClassName={cn("type-data tabular-nums", pnlClass)}
            />

            <FieldRow
              label="Account Ratio"
              value={formatSignedPercent(accountRatio)}
              valueClassName="type-data tabular-nums text-foreground"
            />

            <FieldRow
              label="Account Leverage"
              value={`${formatSize(accountLeverage)}x`}
              valueClassName="type-data tabular-nums text-foreground"
            />
          </div>
        );
      }}
    </Region>
  );
}
