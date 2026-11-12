import { lazy, Suspense, useState } from "react";
import { Surface } from "@/components/surface/surface";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { useAppStore } from "@/stores/use-app-store";
import { PositionManagementPanels, PositionTabTriggers } from "./position-management-panels";
import { PositionManagementModals } from "./position-management-modals";
import { SigningDisabledNotice, PositionManagementScrollEdge } from "./position-management-chrome";
import { BalanceTable } from "./balance-table";
import { usePositionManagementData } from "../hooks/use-position-management-data";
import { usePositionModalsState } from "../hooks/use-position-modals-state";
import { usePositionActions } from "../hooks/use-position-actions";
import { POSITION_PANEL_FILL_CLASS, POSITION_PANEL_FLOW_CLASS } from "./position-management-model";

const ROOT_CLASS = {
  fill: POSITION_PANEL_FILL_CLASS,
  flow: POSITION_PANEL_FLOW_CLASS,
};

const TABS_SURFACE = "flex flex-col gap-1";

const TABS_CLASS = {
  fill: `flex-1 min-h-0 ${TABS_SURFACE}`,
  flow: TABS_SURFACE,
};

const CONNECT_KEY = "trade-position-management";

const ConnectWalletDialogLazy = lazy(() =>
  import("@/components/connect-wallet-dialog").then((m) => ({ default: m.ConnectWalletDialog })),
);

/** No account on this route: one content-sized panel, no tab shell and no wallet queries. */
function PositionManagementEmpty() {
  const isConnectOpen = useAppStore((s) => s.connectWalletOpen[CONNECT_KEY] ?? false);

  return (
    <Surface tier="content" radius="panel" className={ROOT_CLASS.flow}>
      <BalanceTable
        isChLoading={false}
        marginSummary={null}
        positions={[]}
        usdcTotalBalance={0}
        usdcAvailableBalance={0}
        totalUnrealizedPnl={0}
        effectiveAccountTotal={0}
        effectiveAvailableBalance={0}
      />
      {isConnectOpen && (
        <Suspense fallback={null}>
          <ConnectWalletDialogLazy
            open={true}
            onOpenChange={(open) => {
              if (!open) useAppStore.getState().closeConnectWallet(CONNECT_KEY);
            }}
          />
        </Suspense>
      )}
    </Surface>
  );
}

function PositionManagementConnected({
  readOnlyAddress,
  variant,
}: {
  readOnlyAddress: string | undefined;
  variant: "fill" | "flow";
}) {
  const {
    readOnly,
    signingDisabled,
    positions,
    isChLoading,
    isChError,
    retryPositions,
    tabCounts,
    openOrdersCount,
  } = usePositionManagementData(readOnlyAddress);

  const {
    handleCancelOrder,
    handleCancelAllConfirm: cancelAllConfirmed,
    handleCloseMarket,
    submitCloseLimit,
    isCancelPending,
    isPlacePending,
  } = usePositionActions({ signingDisabled });

  const [activeTab, setActiveTab] = useState("balances");

  const {
    closeLimitPosition,
    setCloseLimitPosition,
    tpSlModalOrder,
    setTpSlModalOrder,
    cancelAllDialogOpen,
    setCancelAllDialogOpen,
    handleCloseLimitConfirm,
    handleCancelAllConfirm,
  } = usePositionModalsState({ submitCloseLimit, cancelAllConfirmed });

  return (
    <Surface tier="content" radius="panel" className={ROOT_CLASS[variant]}>
      <SigningDisabledNotice signingDisabled={signingDisabled} />
      <Tabs value={activeTab} onValueChange={setActiveTab} className={TABS_CLASS[variant]}>
        <TabsList variant="line" className="shrink-0 flex gap-1">
          <PositionTabTriggers counts={tabCounts} />
        </TabsList>

        {/* one scroll edge per view — Apple HIG scroll views */}
        <PositionManagementScrollEdge variant={variant} />

        <PositionManagementPanels
          signingDisabled={signingDisabled}
          positions={positions}
          isChLoading={isChLoading}
          isChError={isChError}
          onRetry={() => {
            void retryPositions();
          }}
          readOnly={readOnly}
          readOnlyAddress={readOnlyAddress}
          onCloseMarket={handleCloseMarket}
          onCloseLimit={setCloseLimitPosition}
          onCancelOrder={handleCancelOrder}
          onViewTpSl={setTpSlModalOrder}
          onCancelAll={() => {
            setCancelAllDialogOpen(true);
          }}
          isCancelPending={isCancelPending}
        />
      </Tabs>

      <PositionManagementModals
        tpSlOrder={tpSlModalOrder}
        onCloseTpSl={() => {
          setTpSlModalOrder(null);
        }}
        cancelAllOpen={cancelAllDialogOpen}
        onCancelAllOpenChange={setCancelAllDialogOpen}
        orderCount={openOrdersCount}
        onCancelAllConfirm={handleCancelAllConfirm}
        isCancelPending={isCancelPending}
        closeLimitPosition={closeLimitPosition}
        onCloseCloseLimit={() => {
          setCloseLimitPosition(null);
        }}
        onConfirmLimitClose={handleCloseLimitConfirm}
        isPlacePending={isPlacePending}
      />
    </Surface>
  );
}

export function PositionManagement({
  readOnlyAddress,
  variant = "fill",
}: {
  readOnlyAddress?: string | undefined;
  variant?: "fill" | "flow";
}) {
  const ownAddress = useOwnAddress();

  if (readOnlyAddress === undefined && ownAddress === undefined) {
    return <PositionManagementEmpty />;
  }

  return <PositionManagementConnected readOnlyAddress={readOnlyAddress} variant={variant} />;
}
