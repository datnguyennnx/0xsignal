import { ScrollEdge } from "@/components/surface/scroll-edge";

export function SigningDisabledNotice({ signingDisabled }: { signingDisabled: boolean }) {
  if (!signingDisabled) return null;
  return (
    <p className="w-fit mb-2 shrink-0 rounded-control bg-muted/40 px-2 py-1 type-label text-muted-foreground">
      Viewing another account — connect a wallet to trade.
    </p>
  );
}

export function PositionManagementScrollEdge({ variant }: { variant: "fill" | "flow" }) {
  if (variant !== "fill") return null;
  return <ScrollEdge />;
}
