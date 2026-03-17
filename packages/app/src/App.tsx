import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/layouts/main-layout";
import { MarketDashboard } from "@/features/dashboard/pages/market-dashboard";

const AssetDetail = lazy(() =>
  import("@/features/perp/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const OrderbookPage = lazy(() =>
  import("@/features/perp/pages/orderbook-page").then((m) => ({ default: m.OrderbookPage }))
);
const NotFoundPage = lazy(() =>
  import("@/features/error/pages/not-found").then((m) => ({ default: m.NotFoundPage }))
);

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
                <Route path="/perp" element={<Navigate to="/perp/btc" replace />} />
                <Route path="/perp/:symbol" element={<AssetDetail />} />
                <Route path="/perp/:symbol/orderbook" element={<OrderbookPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
