import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/core/theme/theme-provider";
import { TooltipProvider } from "@/ui/tooltip";
import { Layout } from "@/layouts/main-layout";
import { MarketDashboard } from "@/features/dashboard/pages/market-dashboard";
import { AllBuySignals } from "@/features/signals/pages/buy-signals";
import { AllSellSignals } from "@/features/signals/pages/sell-signals";
import { AssetDetail } from "@/features/asset-detail/pages/asset-detail";

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
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
