import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as api from './api.js';

const BRIGHT_KEY = 'fl_bright';
// One-time cleanup: pre-migration builds stored the JWT itself here. It's
// dead weight now (nothing reads it), but a real 30-day token sitting in
// JS-readable storage indefinitely defeats half the point of this
// migration, so scrub it the moment this code runs on a returning browser.
const LEGACY_TOKEN_KEY = 'fl_user_token';
try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* storage unavailable (private mode, etc.) — nothing to clean up */ }

const AuthCtx = createContext(null);
const ContentCtx = createContext(null);
const BrightCtx = createContext(null);

// The access token lives in memory only now (Task 2 — JWT storage
// migration off localStorage): a page reload has nothing to read, so on
// mount we silently exchange the httpOnly refresh cookie for a fresh one
// via apiRefresh() — that's what makes a reload not force a re-login.
// While the tab stays open, REFRESH_INTERVAL_MS re-runs the same exchange
// well before the 15-minute access token actually expires, so a long
// session never suddenly 401s mid-use.
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function StoreProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [bright, setBrightRaw] = useState(() => localStorage.getItem(BRIGHT_KEY) === '1');
  const refreshTimer = useRef(null);
  // Bumped on every explicit logout. A refresh request already in flight
  // when logout() runs can't be cancelled (clearInterval only stops
  // *future* ticks), so every async handler that's about to call
  // setToken/setUser captures the epoch it started with and checks it's
  // still current before applying its result — otherwise a slow refresh
  // response landing right after logout would silently revive the
  // authenticated UI (and on a shared device, that's a real problem, not
  // just a glitch).
  const sessionEpoch = useRef(0);

  const setBright = useCallback((v) => {
    setBrightRaw(v);
    if (v) localStorage.setItem(BRIGHT_KEY, '1');
    else localStorage.removeItem(BRIGHT_KEY);
  }, []);

  useEffect(() => {
    document.body.style.backgroundColor = bright ? '#f8fafc' : '#0f172a';
    document.body.style.color = bright ? '#0f172a' : 'white';
  }, [bright]);

  useEffect(() => {
    api.fetchContent().then(setContent).catch(console.error);
  }, []);

  const startRefreshTimer = useCallback(() => {
    clearInterval(refreshTimer.current);
    const epoch = sessionEpoch.current;
    refreshTimer.current = setInterval(() => {
      api.apiRefresh()
        .then(({ token: t, user: u }) => {
          if (sessionEpoch.current !== epoch) return; // logged out while this was in flight
          setToken(t);
          setUser(u);
        })
        .catch(err => {
          if (sessionEpoch.current !== epoch) return;
          // Only a genuine 401 means the session is actually gone — a
          // network blip or 5xx on one tick shouldn't log an otherwise-
          // valid session out; just let the next scheduled tick retry.
          if (err?.status === 401) {
            setToken(null);
            setUser(null);
            clearInterval(refreshTimer.current);
          }
        });
    }, REFRESH_INTERVAL_MS);
  }, []);

  useEffect(() => () => clearInterval(refreshTimer.current), []);

  // Silent session restore on load — the ONLY place a fresh token can come
  // from besides an explicit login/signup, since nothing is persisted
  // client-side anymore.
  useEffect(() => {
    const epoch = sessionEpoch.current;
    api.apiRefresh()
      .then(({ token: t, user: u }) => {
        if (sessionEpoch.current !== epoch) return;
        setToken(t);
        setUser(u);
        setLoading(false);
        startRefreshTimer();
        api.claimDaily(t).then(({ user: u2 }) => setUser(u2)).catch(() => {});
      })
      .catch(() => { if (sessionEpoch.current === epoch) setLoading(false); });
  }, [startRefreshTimer]);

  const login = useCallback(async (email, password) => {
    const { token: t, user: u } = await api.apiLogin(email, password);
    setToken(t);
    setUser(u);
    startRefreshTimer();
    api.claimDaily(t).then(({ user: u2 }) => setUser(u2)).catch(() => {});
    return u;
  }, [startRefreshTimer]);

  const signup = useCallback(async (name, email, password, avatar) => {
    const { token: t, user: u } = await api.apiSignup(name, email, password, avatar);
    setToken(t);
    setUser(u);
    startRefreshTimer();
    api.claimDaily(t).then(({ user: u2 }) => setUser(u2)).catch(() => {});
    return u;
  }, [startRefreshTimer]);

  const logout = useCallback(() => {
    sessionEpoch.current += 1; // invalidate any refresh response still in flight
    clearInterval(refreshTimer.current);
    setToken(null);
    setUser(null);
    setLoading(false);
    api.apiLogout().catch(() => {}); // best-effort — local state is already cleared either way
  }, []);

  const updateUser = useCallback((u) => setUser(u), []);

  return (
    <BrightCtx.Provider value={{ bright, setBright }}>
      <AuthCtx.Provider value={{ token, user, loading, state: user?.state || null, login, signup, logout, updateUser }}>
        <ContentCtx.Provider value={content}>
          {children}
        </ContentCtx.Provider>
      </AuthCtx.Provider>
    </BrightCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export const useContent = () => useContext(ContentCtx);
export const useBrightMode = () => useContext(BrightCtx);
