import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useConnection } from "wagmi";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WalletConnectOptions } from "@/components/wallet-connect-options";
import { ADDRESS_PATTERN } from "@/core/utils/address";

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletDialog({ open, onOpenChange }: ConnectWalletDialogProps) {
  const navigate = useNavigate();
  const [addressInput, setAddressInput] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const handleAddressSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = addressInput.trim();
    if (!ADDRESS_PATTERN.test(address)) {
      setAddressError("Enter a valid address (0x followed by 40 hex characters).");
      return;
    }
    onOpenChange(false);
    void navigate(`/whales/${address}`);
  };

  const { isConnected } = useConnection();
  const wasConnectedRef = useRef(isConnected);

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
        <div className="flex flex-col gap-inline">
          <WalletConnectOptions />
          <div className="flex items-center gap-inline">
            <Separator className="flex-1" />
            <span className="shrink-0 type-label text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <form className="flex flex-col gap-inline" onSubmit={handleAddressSubmit}>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wallet-address">Wallet address</Label>
              <Input
                id="wallet-address"
                value={addressInput}
                onChange={(event) => {
                  setAddressInput(event.target.value);
                  setAddressError(null);
                }}
                placeholder="Paste wallet address (0x…)"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={addressError === null ? undefined : true}
                aria-describedby={addressError === null ? undefined : "wallet-address-error"}
              />
              {addressError !== null && (
                <p id="wallet-address-error" className="type-label text-destructive">
                  {addressError}
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="accent"
              size="cta"
              className="w-full"
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
