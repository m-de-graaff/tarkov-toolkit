import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { HomePage } from './pages/HomePage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="app flex h-dvh flex-col">
        <TopNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
