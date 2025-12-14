import { memo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const NotFoundPage = memo(function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="font-mono text-7xl sm:text-8xl font-bold tracking-tighter text-foreground/20">
            404
          </h1>
          <p className="text-lg sm:text-xl font-medium text-foreground">Page Not Found</p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          The requested resource does not exist or has been relocated. Verify the URL or return to
          the dashboard.
        </p>

        <div className="pt-4">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
});
