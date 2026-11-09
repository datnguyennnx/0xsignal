import { useState } from "react";
import { Surface } from "@/components/surface/surface";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { PositionManagementPanels, PositionTabTriggers } from "./position-management-panels";
import { PositionManagementModals } from "./position-management-modals";
import { SigningDisabledNotice, PositionManagementScrollEdge } from "./position-management-chrome";
import { usePositionManagementData } from "../hooks/use-position-management-data";
import { usePositionModalsState } from "../hooks/use-position-modals-state";
import { usePositionActions } from "../hooks/use-position-actions";

const PANEL_SURFACE = "p-3 gap-3";

const ROOT_CLASS = {
  fill: `h-full min-h-0 flex flex-col overflow-y-auto ${PANEL_SURFACE}`,
  flow: `flex flex-col ${PANEL_SURFACE}`,
};

const TABS_SURFACE = "flex flex-col gap-1";

const TABS_CLASS = {
  fill: `flex-1 min-h-0 ${TABS_SURFACE}`,
  flow: TABS_SURFACE,
};

export function PositionManagement({
  readOnlyAddress,
  variant = "fill",
}: {
  readOnlyAddress?: string | undefined;
  variant?: "fill" | "flow";
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
