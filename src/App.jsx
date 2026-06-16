import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider, useAuth, useBrightMode } from './store.jsx';
import BottomNav from './components/BottomNav.jsx';
import TopBar from './components/TopBar.jsx';
import SideNav from './components/SideNav.jsx';
import RightPanel from './components/RightPanel.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LearnPage from './pages/LearnPage.jsx';
import LessonPage from './pages/LessonPage.jsx';
import LeaguePage from './pages/LeaguePage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function AppRoutes() {
  const { user, loading } = useAuth();
  const { bright } = useBrightMode();
  const location = useLocation();

  const isLesson      = location.pathname.startsWith('/lesson/');
  const isLeaderboard = location.pathname === '/leaderboard';
  const showRightPanel = !isLesson && !isLeaderboard;
  const rootBg = bright ? '#f8fafc' : '#0f172a';

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1" style={{ background: rootBg }}>
        <img src="/logo.png" alt="JashMen" className="w-20 h-20 rounded-2xl object-cover animate-pulse" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="flex flex-1" style={{ background: rootBg }}>
      {/* Desktop left sidebar */}
      <div className="hidden lg:block">
        <SideNav />
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <TopBar />
      </div>

      {/* Main scrollable area */}
      <main className="flex-1 overflow-y-auto pt-14 pb-20 lg:pt-0 lg:pb-0 lg:ml-[240px]">
        {/* Desktop wrapper */}
        <div className="lg:max-w-[980px] lg:mx-auto lg:px-8 lg:py-8 lg:flex lg:gap-8 lg:items-start">
          {/* Content column */}
          <div className="flex-1 min-w-0">
            <Routes>
              <Route path="/"            element={<Navigate to="/learn" replace />} />
              <Route path="/learn"       element={<LearnPage />} />
              <Route path="/lesson/:id"  element={<LessonPage />} />
              <Route path="/leaderboard" element={<LeaguePage />} />
              <Route path="/shop"        element={<ShopPage />} />
              <Route path="/profile"     element={<ProfilePage />} />
              <Route path="/settings"    element={<SettingsPage />} />
              <Route path="*"            element={<Navigate to="/learn" replace />} />
            </Routes>
          </div>

          {/* Desktop right panel — hidden on lesson + leaderboard pages */}
          {showRightPanel && (
            <div className="hidden lg:block">
              <RightPanel />
            </div>
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </StoreProvider>
  );
}
