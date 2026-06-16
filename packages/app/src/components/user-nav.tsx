import { useNavigate } from "react-router-dom";
import { RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useConnectWalletPrompt } from "@/hooks/use-connect-wallet-prompt";
import { resetLayout } from "@/features/asset-detail/contexts/layout-store";
import { toast } from "sonner";
import { useAccount, useDisconnect } from "wagmi";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function UserNav() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openConnectWallet, ConnectWalletSheet } = useConnectWalletPrompt();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {isConnected && address ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
              {truncateAddress(address)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[180px] border-border/20" align="end" sideOffset={10}>
            <DropdownMenuItem
              onClick={() => disconnect()}
              className="flex items-center gap-2 cursor-pointer py-2 px-2.5 text-xs font-medium text-foreground/90 hover:text-foreground hover:bg-accent transition-colors rounded-md"
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="h-8 px-3 text-xs font-medium"
          onClick={openConnectWallet}
        >
          Connect Wallet
        </Button>
      )}

      <Button
        variant="outline"
        size="icon-sm"
        className="size-8"
        title="Reset Dashboard Layout"
        onClick={() => {
          resetLayout();
          toast.success("Dashboard layout reset");
        }}
      >
        <RotateCcw className="size-4" />
        <span className="sr-only">Reset Dashboard Layout</span>
      </Button>

      <Button
        variant="outline"
        size="icon-sm"
        className="size-8"
        onClick={() => navigate("/settings?tab=appearance")}
      >
        <Settings className="size-4" />
        <span className="sr-only">Settings</span>
      </Button>

      {ConnectWalletSheet}
    </div>
  );
}
