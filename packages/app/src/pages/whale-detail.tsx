import { useEffect } from "react";
import type { JSX } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortfolioView } from "@/features/portfolio/components/portfolio-view";
import { useAppStore } from "@/stores/use-app-store";
import { isValidAddress, truncateAddress } from "@/core/utils/address";

export function WhaleDetailPage(): JSX.Element {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const setActiveAddress = useAppStore((s) => s.setActiveAddress);

  const valid = address !== undefined && isValidAddress(address);

  useEffect(() => {
    if (address && valid) setActiveAddress(address);
  }, [address, valid, setActiveAddress]);

  useEffect(() => {
    if (address && valid) {
      document.title = `${truncateAddress(address)} | Whales | 0xsignal`;
    }
  }, [address, valid]);

  useEffect(() => {
    if (address && !valid) navigate("/whales", { replace: true });
  }, [address, valid, navigate]);

  const handleBack = () => {
    navigate("/whales");
  };

  if (!address || !valid) {
    return (
      <div className="container-fluid py-6">
        <div className="flex flex-col items-start gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
            <ArrowLeft />
            Whales
          </Button>
          <p className="text-sm text-muted-foreground">
            That isn’t a valid wallet address (0x followed by 40 hex characters).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-6 space-y-6 animate-in fade-in duration-200 ease-premium">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
          <ArrowLeft />
          Whales
        </Button>
        <h1 className="text-[length:var(--text-compact)] font-medium tracking-wide text-muted-foreground">
          {truncateAddress(address)}
        </h1>
      </div>

      <PortfolioView />
    </div>
  );
}
