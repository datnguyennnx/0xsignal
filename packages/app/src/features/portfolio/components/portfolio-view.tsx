import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { Region } from "@/components/region";
import { Surface } from "@/components/surface/surface";
import { WalletProvider } from "@/components/wallet-provider";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { useAppStore } from "@/stores/use-app-store";
import { PositionManagement } from "@/features/trade/components/position-management";
import { POSITION_PANEL_FLOW_CLASS } from "@/features/trade/components/position-management-model";
import { PositionsConnectAction } from "@/features/trade/components/balance-table-sections";
import { POSITIONS_EMPTY_COPY } from "@/features/trade/components/balance-table-model";
import { PortfolioOverview } from "@/features/portfolio/components/portfolio-overview";

const POSITIONS_EMPTY = {
  status: "empty",
  reason: "first-use",
} as const;

const POSITIONS_CONNECT_KEY = "portfolio-positions";

const ConnectWalletDialogLazy = lazy(() =>
  import("@/components/connect-wallet-dialog").then((m) => ({
    default: m.ConnectWalletDialog,
  })),
);

/** The connected wallet's portfolio: summary, chart, and the actionable position stack. */
export function PortfolioView() {
  const { pathname } = useLocation();
  const address = useOwnAddress();
  const isConnectOpen = useAppStore((s) => s.connectWalletOpen[POSITIONS_CONNECT_KEY] ?? false);

  return (
    <>
      <PortfolioOverview />

      {address === undefined ? (
        <Surface tier="content" radius="panel" className={POSITION_PANEL_FLOW_CLASS}>
          <Region
            state={POSITIONS_EMPTY}
            label="Position management"
            className="contents"
            empty={{
              ...POSITIONS_EMPTY_COPY,
              action: <PositionsConnectAction context={POSITIONS_CONNECT_KEY} />,
            }}
          >
            {() => null}
          </Region>
          {isConnectOpen && (
            <Suspense fallback={null}>
              <ConnectWalletDialogLazy
                open={true}
                onOpenChange={(open) => {
                  if (!open) useAppStore.getState().closeConnectWallet(POSITIONS_CONNECT_KEY);
                }}
              />
            </Suspense>
          )}
        </Surface>
      ) : (
        <ErrorBoundary resetKey={pathname}>
          <WalletProvider>
            <PositionManagement variant="flow" />
          </WalletProvider>
        </ErrorBoundary>
      )}
    </>
  );
}
