import { useState, useCallback } from "react";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";

export function useConnectWalletPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const ConnectWalletSheet = isOpen ? (
    <ConnectWalletDialog open={true} onOpenChange={setIsOpen} />
  ) : null;

  return { open, close, ConnectWalletSheet };
}
