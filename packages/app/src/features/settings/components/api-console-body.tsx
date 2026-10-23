import { Terminal, Plug, Lock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { truncateAddress } from "@/core/utils/formatters";

export type ConsoleView = "connect" | "loading" | "signin" | "link" | "form";

interface ApiConsoleBodyProps {
  readonly view: ConsoleView;
  readonly isConnected: boolean;
  readonly address: `0x${string}` | undefined;
  readonly agentPrivateKey: string;
  readonly label: string;
  readonly onAgentPrivateKeyChange: (value: string) => void;
  readonly onLabelChange: (value: string) => void;
  readonly onConnect: () => void;
  readonly onSignIn: () => void;
  readonly onLinkWallet: () => void;
}

export function ApiConsoleBody({
  view,
  isConnected,
  address,
  agentPrivateKey,
  label,
  onAgentPrivateKeyChange,
  onLabelChange,
  onConnect,
  onSignIn,
  onLinkWallet,
}: ApiConsoleBodyProps) {
  return (
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

      {view === "connect" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Plug className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Connect your wallet</p>
            <p className="text-sm text-muted-foreground">Connect your wallet to add API keys.</p>
          </div>
          <Button type="button" variant="outline" onClick={onConnect}>
            Connect Wallet
          </Button>
        </div>
      )}

      {view === "loading" && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {view === "signin" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Sign in to manage API keys</p>
            <p className="text-sm text-muted-foreground">Sign in to add Hyperliquid API keys.</p>
          </div>
          <Button type="button" variant="outline" onClick={onSignIn}>
            Sign In
          </Button>
        </div>
      )}

      {view === "link" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Link a wallet to continue</p>
            <p className="text-sm text-muted-foreground">
              Link a wallet to your account to add API keys.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onLinkWallet}>
            <Plug className="mr-2 size-4" />
            Link Wallet
          </Button>
        </div>
      )}

      {view === "form" && (
        <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
          <div className="space-y-2">
            <Label htmlFor="connected-wallet">Wallet</Label>
            {isConnected && address !== undefined ? (
              <div
                id="connected-wallet"
                className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                {truncateAddress(address)}
              </div>
            ) : (
              <div className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-sm text-muted-foreground">
                Connect Wallet first
              </div>
            )}
            <p className="text-[length:var(--text-micro)] text-muted-foreground">
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
              onChange={(e) => {
                onAgentPrivateKeyChange(e.target.value);
              }}
              required
              autoComplete="off"
            />
            <p className="text-[length:var(--text-micro)] text-muted-foreground">
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
              onChange={(e) => {
                onLabelChange(e.target.value);
              }}
            />
            <p className="text-[length:var(--text-micro)] text-muted-foreground">
              Optional name to identify this credential.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
