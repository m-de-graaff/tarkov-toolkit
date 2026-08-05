import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopNav } from './components/TopNav';
import { RouteMetaSync } from './lib/routeMeta';
import { AmmoPage } from './pages/AmmoPage';
import { HideoutPage } from './pages/HideoutPage';
import { HomePage } from './pages/HomePage';
import { ItemsPage } from './pages/ItemsPage';
import { MarketPage } from './pages/MarketPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';
import { XpPage } from './pages/XpPage';

// the boundary wraps only the routed content - the nav must survive a page
// crash so the user can navigate away; a route change resets a shown error
function RoutedPages() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/hideout" element={<HideoutPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/ammo" element={<AmmoPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/xp" element={<XpPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <RouteMetaSync />
      <div className="app flex h-dvh flex-col">
        <TopNav />
        <RoutedPages />
      </div>
    </BrowserRouter>
  );
}
