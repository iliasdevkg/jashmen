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

// How long the shop's stock, the lesson list and the limits stay
// trustworthy without asking again. One second, so in practice every page a
// learner opens refetches — the freshest possible reading, at the cost of a
// request per navigation. The window is not zero because a single click can
// still fire two renders, and one request per click is the point.
const STALE_AFTER_MS = 1000;

export function StoreProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [bright, setBrightRaw] = useState(() => localStorage.getItem(BRIGHT_KEY) === '1');
  // Set by the one daily claim per day that actually moved the streak —
  // App.jsx turns this into the celebration screen, then clears it.
  const [streakEvent, setStreakEvent] = useState(null);
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

  // Content was fetched once and then never again, so an admin edit — a new
  // lesson, a prize whose codes have run out — stayed invisible until the
  // tab was reloaded. It is refetched now whenever it might have gone
  // stale, and `setContent` only ever runs on success, so a failed refresh
  // leaves the last good copy on screen rather than blanking it.
  const contentFetchedAt = useRef(0);

  const refreshContent = useCallback((force = false) => {
    if (!force && Date.now() - contentFetchedAt.current < STALE_AFTER_MS) return;
    contentFetchedAt.current = Date.now();
    api.fetchContent()
      .then(setContent)
      .catch(() => { contentFetchedAt.current = 0; }); // let the next attempt retry
  }, []);

  useEffect(() => { refreshContent(true); }, [refreshContent]);

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
  // The daily claim fires on every session start, so `claimed` — true only
  // on the call that actually rolled the streak forward — is what keeps the
  // celebration to once a day instead of once a reload.
  const claimDaily = useCallback((t) => {
    const epoch = sessionEpoch.current;
    api.claimDaily(t)
      .then((res) => {
        if (sessionEpoch.current !== epoch) return;
        setUser(res.user);
        if (res.claimed && (res.streak || 0) > 0) {
          setStreakEvent({
            streak: res.streak,
            activeDays: res.activeDays || [],
            increased: !!res.streakIncreased,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const epoch = sessionEpoch.current;
    api.apiRefresh()
      .then(({ token: t, user: u }) => {
        if (sessionEpoch.current !== epoch) return;
        setToken(t);
        setUser(u);
        setLoading(false);
        startRefreshTimer();
        claimDaily(t);
      })
      .catch(() => { if (sessionEpoch.current === epoch) setLoading(false); });
  }, [startRefreshTimer, claimDaily]);

  const login = useCallback(async (email, password) => {
    const { token: t, user: u } = await api.apiLogin(email, password);
    setToken(t);
    setUser(u);
    startRefreshTimer();
    claimDaily(t);
    return u;
  }, [startRefreshTimer, claimDaily]);

  const signup = useCallback(async (name, email, password, avatar) => {
    const { token: t, user: u } = await api.apiSignup(name, email, password, avatar);
    setToken(t);
    setUser(u);
    startRefreshTimer();
    claimDaily(t);
    return u;
  }, [startRefreshTimer, claimDaily]);

  // Google sign-in lands here with an id_token; the server turns it into the
  // same session login/signup produce, so from this point on there is no
  // difference in how the session is held or refreshed.
  const loginWithGoogle = useCallback(async (idToken) => {
    const { token: t, user: u } = await api.apiGoogleAuth(idToken);
    setToken(t);
    setUser(u);
    startRefreshTimer();
    claimDaily(t);
    return u;
  }, [startRefreshTimer, claimDaily]);

  const logout = useCallback(() => {
    sessionEpoch.current += 1; // invalidate any refresh response still in flight
    clearInterval(refreshTimer.current);
    setToken(null);
    setUser(null);
    setStreakEvent(null);
    setLoading(false);
    api.apiLogout().catch(() => {}); // best-effort — local state is already cleared either way
  }, []);

  const updateUser = useCallback((u) => setUser(u), []);

  // A password change revokes every session server-side and hands this
  // device a brand-new pair, so the in-memory access token has to be
  // swapped for the returned one or the very next request 401s.
  const adoptSession = useCallback((t, u) => {
    setToken(t);
    if (u) setUser(u);
    startRefreshTimer();
  }, [startRefreshTimer]);

  // Everything the current screen shows, refetched together. Exposed so a
  // route change can ask for it (App.jsx) and so a page can force it after
  // a write of its own.
  //
  // Deliberately GET /u/me and not apiRefresh(): a refresh ROTATES the
  // session token (db.js#rotateSession revokes the old one and writes the
  // new one to disk), so hanging it off every navigation would burn a
  // session and a disk write per page — and a refresh that failed would log
  // the learner out mid-browse. Token renewal stays where it belongs, on
  // the twelve-minute timer and at mount. This just re-reads the account.
  const meFetchedAt = useRef(0);

  const refreshAll = useCallback((force = false) => {
    refreshContent(force);
    if (!token) return;
    // Same staleness gate the content has, and for the same reason: a burst
    // of navigations must not become a burst of requests. It is also the
    // backstop if a caller ever re-enters this in a loop again.
    if (!force && Date.now() - meFetchedAt.current < STALE_AFTER_MS) return;
    meFetchedAt.current = Date.now();
    const epoch = sessionEpoch.current;
    api.fetchMe(token)
      .then((u) => {
        if (sessionEpoch.current !== epoch) return;
        setUser(u);
      })
      .catch(() => { meFetchedAt.current = 0; }); // the screen keeps what it had
  }, [refreshContent, token]);

  // Coming back to the tab is the case that used to hurt most: a page left
  // open overnight showed yesterday's coins, yesterday's stock and a token
  // that had long since expired.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') refreshAll(true);
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [refreshAll]);

  const dismissStreakEvent = useCallback(() => setStreakEvent(null), []);

  return (
    <BrightCtx.Provider value={{ bright, setBright }}>
      <AuthCtx.Provider value={{
        token, user, loading, state: user?.state || null,
        login, signup, loginWithGoogle, logout, updateUser, adoptSession,
        streakEvent, dismissStreakEvent,
        refreshAll, refreshContent,
      }}>
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
