import { useConnect, useConnectors } from "wagmi";
import { Metamask, Coinbase } from "@thesvg/react";
import { toast } from "sonner";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";

export function WalletConnectOptions() {
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

        if (address !== undefined && address !== "") {
          try {
            await api.createWallet({ walletAddress: address });
          } catch {
            // Wallet may already be linked — that's fine
          }
          void refreshWalletStatus();
        }
      },
    },
  });
  const connectors = useConnectors();

  // Find connectors by id or name — wagmi versions vary and connector IDs may differ.
  const metaMaskConnector = connectors.find((c) => c.id === "metaMask" || c.name === "MetaMask");
  const coinbaseConnector = connectors.find(
    (c) => c.id === "coinbaseWallet" || c.name?.includes("Coinbase"),
  );

  return (
    <div className="flex flex-col gap-3">
      {metaMaskConnector === undefined && coinbaseConnector === undefined && (
        <Alert className="px-3 py-2.5">
          <AlertTriangleIcon />
          <AlertDescription className="text-sm leading-relaxed">
            No wallet connectors available. Install MetaMask or Coinbase Wallet to continue.
          </AlertDescription>
        </Alert>
      )}
      {metaMaskConnector !== undefined && (
        <Button
          variant="outline"
          size="lg"
          className="h-10 w-full gap-3 justify-start"
          disabled={isPending}
          onClick={() => {
            mutate({ connector: metaMaskConnector });
          }}
        >
          <Metamask className="size-5 shrink-0" />
          {isPending ? "Connecting…" : "MetaMask"}
        </Button>
      )}
      {coinbaseConnector !== undefined && (
        <Button
          variant="outline"
          size="lg"
          className="h-10 w-full gap-3 justify-start"
          disabled={isPending}
          onClick={() => {
            mutate({ connector: coinbaseConnector });
          }}
        >
          <Coinbase className="size-5 shrink-0" />
          {isPending ? "Connecting…" : "Coinbase Wallet"}
        </Button>
      )}
    </div>
  );
}
