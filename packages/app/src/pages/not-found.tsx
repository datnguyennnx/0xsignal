import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-(--trading-region-height) flex-col items-center justify-center px-4 text-center">
      <div className="flex max-w-md flex-col gap-stack">
        <div className="flex flex-col gap-1">
          <h1 className="type-display font-bold tracking-tighter text-muted-foreground">404</h1>
          <p className="type-title font-medium text-foreground">Page Not Found</p>
        </div>

        <p className="type-body leading-relaxed text-muted-foreground">
          The requested resource does not exist or has been relocated. Verify the URL or return to
          trade.
        </p>

        <Button
          render={<Link to="/trade/BTC" />}
          variant="outline"
          className="gap-inline self-center"
        >
          <ArrowLeft className="size-icon" />
          Return to Trade
        </Button>
      </div>
    </div>
  );
}
