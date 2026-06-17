import { useEffect, useRef } from "react";
import { useConnect, useConnection, useConnectors } from "wagmi";
import { Metamask, Coinbase } from "@thesvg/react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { useAuth } from "@/core/providers/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const { refreshWalletStatus } = useAuth();
  const { mutate } = useConnect({
    mutation: {
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>Choose a wallet to connect with</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pb-2">
          {metaMaskConnector && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-3 justify-start"
              onClick={() => mutate({ connector: metaMaskConnector })}
            >
              <Metamask className="size-5 shrink-0" />
              MetaMask
            </Button>
          )}
          {coinbaseConnector && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-3 justify-start"
              onClick={() => mutate({ connector: coinbaseConnector })}
            >
              <Coinbase className="size-5 shrink-0" />
              Coinbase Wallet
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
