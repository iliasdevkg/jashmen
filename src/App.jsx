import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { StoreProvider, useAuth, useBrightMode } from './store.jsx';
import { LocaleProvider } from './i18n.jsx';
import BottomNav from './components/BottomNav.jsx';
import TopBar from './components/TopBar.jsx';
import SideNav from './components/SideNav.jsx';
import RightPanel from './components/RightPanel.jsx';
import BusinessPage from './pages/BusinessPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LearnPage from './pages/LearnPage.jsx';
import LessonPage from './pages/LessonPage.jsx';
import LeaguePage from './pages/LeaguePage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import StreakCelebration from './components/StreakCelebration.jsx';

// Task 9 — shown exactly once, on a device/browser that's never dismissed
// it before. A returning user (or one already signed in) never sees this
// again — the flag persists in localStorage, same convention as the locale
// and bright-mode preferences (src/i18n.jsx, src/store.jsx).
const ONBOARDED_KEY = 'fl_onboarded';

function AppRoutes() {
  const { user, loading, streakEvent, dismissStreakEvent, refreshAll } = useAuth();
  const { bright } = useBrightMode();
  const location = useLocation();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(ONBOARDED_KEY) === '1');

  // Read once: the display mode can't change without a fresh launch, and
  // `navigator.standalone` is the iOS-only twin of the media query.
  const standalone = useMemo(
    () => window.matchMedia?.('(display-mode: standalone)').matches === true
      || window.navigator.standalone === true,
    [],
  );

  // Landing on a page refreshes what it is about to show — but only when
  // that data has had time to go stale (store.jsx#STALE_AFTER_MS), so
  // clicking between tabs costs nothing and never blanks a screen. The
  // lesson player is left out on purpose: a refetch mid-question would
  // remount the deck under the learner's thumb.
  //
  // The dependency list is deliberately just the path and whether anyone is
  // signed in. It cannot include `user` or `refreshAll`: refreshing REPLACES
  // the user object and rebuilds the callback, so either one in here makes
  // the effect retrigger itself — a loop that fired thousands of requests a
  // second the first time this shipped.
  const path = location.pathname;
  const signedIn = !!user;
  const refreshRef = useRef(refreshAll);
  useEffect(() => { refreshRef.current = refreshAll; }, [refreshAll]);
  useEffect(() => {
    if (!signedIn || path.startsWith('/lesson/')) return;
    refreshRef.current?.(false);
  }, [path, signedIn]);

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

  // Two public marketing pages sit outside the signed-in / signed-out split.
  // Both carry their own nav and footer, so neither needs the app shell.
  //
  //   /partners  the B2B site, at the URL it shipped on. `/` is its real
  //              home now (below); this alias keeps every link already sent
  //              to a bank working, and index.html's canonical points both
  //              at `/`.
  //
  // It does not redirect a signed-in visitor into the product: a
  // university's own staff read it while signed in as a learner, and
  // bouncing them to /learn would look like the page had been taken down.
  //
  // /app used to serve a second, student-facing marketing page. It was
  // removed — one front door, and the two doors out of it (/start, /login)
  // are what a student needs from it.
  if (location.pathname === '/partners') return <BusinessPage />;

  // A signed-out visitor gets the business site at `/` and reaches the
  // product through one of two doors:
  //
  //   /start — "Акысыз баштоо": onboarding first (once per browser), then
  //            the form on its sign-up tab
  //   /login — "Кирүү": straight to the form on its sign-in tab
  //
  // Anything else — /learn, /shop, a bookmarked lesson — belongs to a
  // student who is simply signed out. They want their account back, not a
  // pitch, so they land on the sign-in form rather than on `/`, which would
  // answer "where are my lessons" with "sponsor a campus".
  if (!user) {
    return (
      <Routes>
        <Route
          path="/"
          element={
            // Launching from a home-screen icon is not a visit to the
            // website — that person already knows what JashMen is and
            // wants their account, not the pitch.
            standalone ? <Navigate to="/start" replace /> : <BusinessPage />
          }
        />
        <Route
          path="/start"
          element={
            onboarded ? <AuthPage initialMode="signup" /> : (
              <OnboardingPage
                onDone={() => {
                  localStorage.setItem(ONBOARDED_KEY, '1');
                  setOnboarded(true);
                }}
              />
            )
          }
        />
        <Route path="/login" element={<AuthPage initialMode="login" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

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

      {/* Streak screen — over everything, including the lesson player, since
          it only ever fires on the first session of a new day. */}
      <AnimatePresence>
        {streakEvent && (
          <StreakCelebration
            key="streak"
            streak={streakEvent.streak}
            activeDays={streakEvent.activeDays}
            bright={bright}
            onDismiss={dismissStreakEvent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <StoreProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </StoreProvider>
    </LocaleProvider>
  );
}
