import { useEffect, useRef } from "react";
import { useConnect, useConnection, useConnectors } from "wagmi";
import { Metamask, Coinbase } from "@thesvg/react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "cn";
import { AlertTriangleIcon } from "lucide-react";

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const refreshWalletStatus = useAuthStore((s) => s.refreshWalletStatus);
  const { mutate, isPending } = useConnect({
    mutation: {
      onError: (err) => {
        console.error("[Wallet] Connection failed:", err);
        toast.error("Wallet connection failed", {
          description: "Check your wallet and try again.",
        });
      },
      onSuccess: async (data) => {
        // data.accounts[0] is the connected wallet address
        // Must be a string (wagmi v3 returns readonly [Address, ...Address[]])
        const address =
          typeof data.accounts[0] === "string"
            ? data.accounts[0]
            : (data.accounts[0] as { address?: string })?.address;

        if (address) {
          try {
            await api.createWallet({ walletAddress: String(address) });
          } catch {
            // Wallet may already be linked — that's fine
          }
          refreshWalletStatus();
        }
      },
    },
  });
  const connectors = useConnectors();
  const { isConnected } = useConnection();
  const wasConnectedRef = useRef(isConnected);

  // Find connectors by id or name — wagmi versions vary and connector IDs may differ.
  const metaMaskConnector = connectors.find((c) => c.id === "metaMask" || c.name === "MetaMask");
  const coinbaseConnector = connectors.find(
    (c) => c.id === "coinbaseWallet" || c.name?.includes("Coinbase"),
  );

  // Auto-close dialog when a connection is established (but not on initial mount
  // if the user is already connected — that would cause a flash).
  useEffect(() => {
    if (open && isConnected && !wasConnectedRef.current) {
      onOpenChange(false);
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(MODAL_CONTENT_CLASS, "sm:max-w-sm p-5 gap-[clamp(0.5rem,1vw,1rem)]")}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>Choose a wallet to connect with</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {!metaMaskConnector && !coinbaseConnector && (
            <Alert className="px-3 py-2.5">
              <AlertTriangleIcon />
              <AlertDescription className="text-sm leading-relaxed">
                No wallet connectors available. Install MetaMask or Coinbase Wallet to continue.
              </AlertDescription>
            </Alert>
          )}
          {metaMaskConnector && (
            <Button
              variant="outline"
              size="lg"
              className="h-10 w-full gap-3 justify-start"
              disabled={isPending}
              onClick={() => mutate({ connector: metaMaskConnector })}
            >
              <Metamask className="size-5 shrink-0" />
              {isPending ? "Connecting…" : "MetaMask"}
            </Button>
          )}
          {coinbaseConnector && (
            <Button
              variant="outline"
              size="lg"
              className="h-10 w-full gap-3 justify-start"
              disabled={isPending}
              onClick={() => mutate({ connector: coinbaseConnector })}
            >
              <Coinbase className="size-5 shrink-0" />
              {isPending ? "Connecting…" : "Coinbase Wallet"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
