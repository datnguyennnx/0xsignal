import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MarketDashboard } from "./pages/MarketDashboard";
import { AllBuySignals } from "./pages/AllBuySignals";
import { AllSellSignals } from "./pages/AllSellSignals";
import { AssetDetail } from "./pages/AssetDetail";

function App() {
  return (
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
  );
}

export default App;
