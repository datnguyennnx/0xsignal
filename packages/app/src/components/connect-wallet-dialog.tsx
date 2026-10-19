import { useEffect, useRef, useState } from "react";
import { useConnect, useConnection, useConnectors } from "wagmi";
import { Metamask, Coinbase } from "@thesvg/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { useAppStore } from "@/stores/use-app-store";
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
import { ADDRESS_PATTERN, truncateAddress } from "@/core/utils/address";

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const refreshWalletStatus = useAuthStore((s) => s.refreshWalletStatus);
  const setActiveAddress = useAppStore((s) => s.setActiveAddress);
  const activeAddress = useAppStore((s) => s.activeAddress);
  const clearActiveAddress = useAppStore((s) => s.clearActiveAddress);
  const [addressInput, setAddressInput] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const handleAddressSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const address = addressInput.trim();
    if (!ADDRESS_PATTERN.test(address)) {
      setAddressError("Enter a valid address (0x followed by 40 hex characters).");
      return;
    }
    setActiveAddress(address);
    onOpenChange(false);
  };

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
      clearActiveAddress();
      onOpenChange(false);
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, open, onOpenChange, clearActiveAddress]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(MODAL_CONTENT_CLASS, "sm:max-w-sm p-5 gap-[clamp(0.5rem,1vw,1rem)]")}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>Choose a wallet to connect with</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[clamp(0.5rem,1vw,1rem)]">
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
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="shrink-0 text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          {activeAddress && (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Viewing read-only: {truncateAddress(activeAddress)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => clearActiveAddress()}
              >
                Exit
              </Button>
            </div>
          )}
          <form className="flex flex-col gap-2.5" onSubmit={handleAddressSubmit}>
            <Input
              value={addressInput}
              onChange={(event) => {
                setAddressInput(event.target.value);
                setAddressError(null);
              }}
              placeholder="Paste wallet address (0x…)"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={addressError ? true : undefined}
              aria-label="Wallet address"
            />
            {addressError && <p className="text-sm text-destructive">{addressError}</p>}
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="h-10 w-full"
              disabled={!addressInput.trim()}
            >
              View address
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
