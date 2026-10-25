import { useCallback } from "react";
import { useConnection } from "wagmi";
import { useNavigate } from "react-router-dom";

import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAuthStore } from "@/stores/use-auth-store";
import { useAppStore } from "@/stores/use-app-store";
import { useCredentialActions } from "../hooks/use-credential-actions";
import { ApiConsoleBody, type ConsoleView } from "./api-console-body";

export function ApiConsole() {
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["settings-api-console"] ?? false,
  );
  const openConnectPrompt = useCallback(() => {
    useAppStore.getState().openConnectWallet("settings-api-console");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("settings-api-console");
  }, []);
  const { address, isConnected } = useConnection();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasLinkedWallet = useAuthStore((s) => s.hasLinkedWallet);
  const navigate = useNavigate();
  const { linkWallet } = useCredentialActions();

  let view: ConsoleView = "form";
  if (!isConnected) {
    view = "connect";
  } else if (isLoading) {
    view = "loading";
  } else if (!isAuthenticated) {
    view = "signin";
  } else if (!hasLinkedWallet) {
    view = "link";
  }

  return (
    <>
      <ApiConsoleBody
        view={view}
        isConnected={isConnected}
        address={address}
        onConnect={openConnectPrompt}
        onSignIn={() => {
          void navigate("/login");
        }}
        onLinkWallet={() => {
          if (address !== undefined) void linkWallet(address);
        }}
      />

      {isConnectWalletOpen && (
        <ConnectWalletDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) closeConnectWallet();
          }}
        />
      )}
    </>
  );
}
