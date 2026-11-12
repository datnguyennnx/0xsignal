import { useNavigate } from "react-router";

import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { WalletProvider, useWalletConnection } from "@/components/wallet-provider";
import { useAuthStore } from "@/stores/use-auth-store";
import { useAppStore } from "@/stores/use-app-store";
import { useApiConsoleView } from "../hooks/use-api-console-view";
import { useCredentialActions } from "../hooks/use-credential-actions";
import { ApiConsoleBody } from "./api-console-body";

const CONNECT_KEY = "settings-api-console";

function ApiConsoleWallet() {
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen[CONNECT_KEY] ?? false);
  const openConnectWallet = useAppStore((s) => s.openConnectWallet);
  const closeConnectWallet = useAppStore((s) => s.closeConnectWallet);
  const { address, isConnected } = useWalletConnection();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasLinkedWallet = useAuthStore((s) => s.hasLinkedWallet);
  const hasUnverifiedWallet = useAuthStore((s) => s.hasUnverifiedWallet);
  const { linkWallet } = useCredentialActions();
  const navigate = useNavigate();
  const view = useApiConsoleView({ isConnected, isAuthenticated, hasLinkedWallet });

  return (
    <>
      <ApiConsoleBody
        view={view}
        isConnected={isConnected}
        address={address}
        needsReverification={hasUnverifiedWallet}
        onConnect={() => {
          openConnectWallet(CONNECT_KEY);
        }}
        onSignIn={() => {
          void navigate("/login");
        }}
        onLinkWallet={() => {
          if (address !== undefined) void linkWallet(address);
        }}
      />

      <ConnectWalletDialog
        open={isConnectWalletOpen}
        onOpenChange={(open) => {
          if (!open) closeConnectWallet(CONNECT_KEY);
        }}
      />
    </>
  );
}

/** The wallet chunk loads only for this console, the one settings tab that signs. */
export function ApiConsole() {
  return (
    <WalletProvider>
      <ApiConsoleWallet />
    </WalletProvider>
  );
}
