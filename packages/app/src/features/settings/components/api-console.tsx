import { useState, useCallback, useEffect } from "react";
import { Terminal, Plug, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { privateKeyToAccount } from "viem/accounts";
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SaveBar } from "@/components/save-bar";
import { ConnectWalletDialog } from "@/components/connect-wallet-dialog";
import { useAuthStore } from "@/stores/use-auth-store";
import { useAppStore } from "@/stores/use-app-store";
import { api } from "@/services/api";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ApiConsole() {
  const isConnectWalletOpen = useAppStore(
    (s) => s.connectWalletOpen["settings-api-console"] ?? false,
  );
  const openConnectPrompt = useCallback(
    () => useAppStore.getState().openConnectWallet("settings-api-console"),
    [],
  );
  const closeConnectWallet = useCallback(
    () => useAppStore.getState().closeConnectWallet("settings-api-console"),
    [],
  );
  const { address, isConnected } = useAccount();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasLinkedWallet = useAuthStore((s) => s.hasLinkedWallet);
  const refreshWalletStatus = useAuthStore((s) => s.refreshWalletStatus);
  const navigate = useNavigate();

  const [agentPrivateKey, setAgentPrivateKey] = useState("");
  const [label, setLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [initialAgentPrivateKey] = useState("");
  const [initialLabel] = useState("");

  const hasChanges = agentPrivateKey !== initialAgentPrivateKey || label !== initialLabel;
  useEffect(() => {
    if (hasChanges) {
      useAppStore.getState().markDirty("settings-api-console");
    } else {
      useAppStore.getState().markClean("settings-api-console");
    }
    return () => {
      useAppStore.getState().markClean("settings-api-console");
    };
  }, [hasChanges]);

  const handleSave = async () => {
    if (!isConnected || !address) {
      openConnectPrompt();
      return;
    }

    if (!agentPrivateKey.trim()) {
      toast.error("API key required", {
        description: "Enter your Hyperliquid API key.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const wallets = await api.listWallets();
      if (!wallets.length) {
        toast.error("No wallet linked", {
          description: "Link a wallet first.",
        });
        return;
      }
      const primaryWallet = wallets[0];
      const accountId = primaryWallet.id;

      const cleanKey = agentPrivateKey.trim().startsWith("0x")
        ? agentPrivateKey.trim()
        : `0x${agentPrivateKey.trim()}`;
      const account = privateKeyToAccount(cleanKey as `0x${string}`);
      const agentAddress = account.address;

      await api.createCredential({
        accountId,
        agentAddress,
        agentPrivateKey: agentPrivateKey.trim(),
        label: label.trim() || undefined,
      });

      toast.success("Credential saved", {
        description: "Encrypted at rest.",
      });

      handleReset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("Failed to save credential", {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAgentPrivateKey("");
    setLabel("");
  };

  return (
    <>
      <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Terminal className="size-4 text-primary" />
            API Console
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add your Hyperliquid agent key to enable trading. Encrypted at rest.
          </p>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Plug className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Connect your wallet</p>
              <p className="text-sm text-muted-foreground">Connect your wallet to add API keys.</p>
            </div>
            <Button type="button" variant="outline" onClick={openConnectPrompt}>
              Connect Wallet
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Sign in to manage API keys</p>
              <p className="text-sm text-muted-foreground">Sign in to add Hyperliquid API keys.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/login")}>
              Sign In
            </Button>
          </div>
        ) : !hasLinkedWallet ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Link a wallet to continue</p>
              <p className="text-sm text-muted-foreground">
                Link a wallet to your account to add API keys.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (address) {
                  try {
                    await api.createWallet({ walletAddress: address });
                    toast.success("Wallet linked", {
                      description: `${truncateAddress(address)} linked to your account.`,
                    });
                    refreshWalletStatus();
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Failed to link wallet";
                    toast.error("Failed to link wallet", { description: msg });
                  }
                }
              }}
            >
              <Plug className="mr-2 size-4" />
              Link Wallet
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
            <div className="space-y-2">
              <Label htmlFor="connected-wallet">Wallet</Label>
              {isConnected && address ? (
                <div
                  id="connected-wallet"
                  className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                >
                  {truncateAddress(address)}
                </div>
              ) : (
                <div className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground">
                  Connect Wallet first
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Auto-resolved from your connected wallet.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-private-key">Hyperliquid API Key</Label>
              <Input
                id="agent-private-key"
                type="password"
                placeholder="••••••••••••••••••••••••••"
                value={agentPrivateKey}
                onChange={(e) => setAgentPrivateKey(e.target.value)}
                required
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Masked on screen, encrypted at rest.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                type="text"
                placeholder="e.g. Main trading bot"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional name to identify this credential.
              </p>
            </div>
          </div>
        )}
      </div>

      {hasLinkedWallet && isConnected && isAuthenticated && (
        <SaveBar
          open={hasChanges}
          onSave={handleSave}
          onReset={handleReset}
          isSaving={isSubmitting}
        />
      )}

      {isConnectWalletOpen && (
        <ConnectWalletDialog open={true} onOpenChange={(open) => !open && closeConnectWallet()} />
      )}
    </>
  );
}
