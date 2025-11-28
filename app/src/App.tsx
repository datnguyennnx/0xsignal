import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/layouts/main-layout";

// Lazy load all page components for code splitting
const MarketDashboard = lazy(() =>
  import("@/features/dashboard/pages/market-dashboard").then((m) => ({
    default: m.MarketDashboard,
  }))
);
const AllBuySignals = lazy(() =>
  import("@/features/signals/pages/buy-signals").then((m) => ({ default: m.AllBuySignals }))
);
const AllSellSignals = lazy(() =>
  import("@/features/signals/pages/sell-signals").then((m) => ({ default: m.AllSellSignals }))
);
const AllHoldSignals = lazy(() =>
  import("@/features/signals/pages/hold-signals").then((m) => ({ default: m.AllHoldSignals }))
);
const AssetDetail = lazy(() =>
  import("@/features/asset-detail/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const MarketDepthPage = lazy(() =>
  import("@/features/market-depth/pages/market-depth").then((m) => ({ default: m.MarketDepthPage }))
);
const BuybackSignalsPage = lazy(() =>
  import("@/features/buyback/pages/buyback-signals").then((m) => ({
    default: m.BuybackSignalsPage,
  }))
);

// Minimal loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <BrowserRouter>
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<MarketDashboard />} />
                <Route path="/buy" element={<AllBuySignals />} />
                <Route path="/sell" element={<AllSellSignals />} />
                <Route path="/hold" element={<AllHoldSignals />} />
                <Route path="/asset/:symbol" element={<AssetDetail />} />
                <Route path="/market-depth" element={<MarketDepthPage />} />
                <Route path="/buyback" element={<BuybackSignalsPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
