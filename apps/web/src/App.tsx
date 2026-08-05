import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { AmmoPage } from './pages/AmmoPage';
import { HideoutPage } from './pages/HideoutPage';
import { HomePage } from './pages/HomePage';
import { ItemsPage } from './pages/ItemsPage';
import { MarketPage } from './pages/MarketPage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';
import { XpPage } from './pages/XpPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="app flex h-dvh flex-col">
        <TopNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/hideout" element={<HideoutPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/ammo" element={<AmmoPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/xp" element={<XpPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
