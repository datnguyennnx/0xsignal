import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { ResetLayoutButton } from "@/components/reset-layout-button";
import { useAppStore } from "@/stores/use-app-store";
import { truncateAddress } from "@/core/utils/address";
import { useConnection, useDisconnect } from "wagmi";

export function UserNav() {
  const { address, isConnected } = useConnection();
  const { mutate: disconnect } = useDisconnect();
  const activeAddress = useAppStore((s) => s.activeAddress);
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["user-nav"] ?? false);
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("user-nav");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("user-nav");
  }, []);
  const clearActiveAddress = useCallback(() => {
    useAppStore.getState().clearActiveAddress();
  }, []);
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {activeAddress !== null && activeAddress !== "" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-8 px-3 text-xs" />}
          >
            {truncateAddress(activeAddress)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10}>
            <DropdownMenuItem
              onClick={clearActiveAddress}
              className="flex items-center gap-2 cursor-pointer py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground hover:bg-accent transition-colors rounded-md"
            >
              Exit read-only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : isConnected && address !== undefined ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="h-8 px-3 text-xs" />}
          >
            {truncateAddress(address)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={10}>
            <DropdownMenuItem
              onClick={() => {
                disconnect();
              }}
              className="flex items-center gap-2 cursor-pointer py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground hover:bg-accent transition-colors rounded-md"
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="default"
          className="h-8 px-3 text-xs font-medium"
          onClick={openConnectWallet}
        >
          Connect Wallet
        </Button>
      )}

      <ResetLayoutButton />

      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => {
          void navigate("/settings?tab=appearance");
        }}
      >
        <Settings className="size-4" />
        <span className="sr-only">Settings</span>
      </Button>

      {isConnectWalletOpen && (
        <ConnectWalletDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              closeConnectWallet();
            }
          }}
        />
      )}
    </div>
  );
}
