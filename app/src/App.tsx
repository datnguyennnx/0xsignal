import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/core/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/layouts/main-layout";
import { MarketDashboard } from "@/features/dashboard/pages/market-dashboard";
import { AllBuySignals } from "@/features/signals/pages/buy-signals";
import { AllSellSignals } from "@/features/signals/pages/sell-signals";
import { AssetDetail } from "@/features/asset-detail/pages/asset-detail";
import { MarketDepthPage } from "@/features/market-depth/pages/market-depth";
import { BuybackSignalsPage } from "@/features/buyback/pages/buyback-signals";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<MarketDashboard />} />
              <Route path="/buy" element={<AllBuySignals />} />
              <Route path="/sell" element={<AllSellSignals />} />
              <Route path="/asset/:symbol" element={<AssetDetail />} />
              <Route path="/market-depth" element={<MarketDepthPage />} />
              <Route path="/buyback" element={<BuybackSignalsPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
