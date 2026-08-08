import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as api from './api.js';

// One-time cleanup: pre-migration builds stored the admin JWT itself here
// — the single highest-value token in the app. Nothing reads it anymore,
// but leaving it sitting in JS-readable storage indefinitely defeats half
// the point of this migration, so scrub it the moment this code runs on
// a returning browser.
const LEGACY_TOKEN_KEY = 'fl_admin_token';
try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* storage unavailable (private mode, etc.) — nothing to clean up */ }

const AdminCtx = createContext(null);

// Access token lives in memory only (Task 2 — JWT storage migration off
// localStorage); a reload has nothing to read, so on mount we silently
// exchange the httpOnly admin-refresh cookie for a fresh one via
// refresh(). REFRESH_INTERVAL_MS re-runs that exchange well before the
// 15-minute admin access token expires, so an active editing session
// doesn't suddenly 401 mid-edit.
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);
  // Bumped on every explicit logout — see src/store.jsx's identical guard
  // for the full rationale: clearInterval only stops *future* ticks, so a
  // refresh request already in flight when logout() runs would otherwise
  // still land afterward and revive `token`.
  const sessionEpoch = useRef(0);

  const startRefreshTimer = useCallback(() => {
    clearInterval(refreshTimer.current);
    const epoch = sessionEpoch.current;
    refreshTimer.current = setInterval(() => {
      api.refresh()
        .then(({ token: t }) => {
          if (sessionEpoch.current !== epoch) return;
          setToken(t);
        })
        .catch(err => {
          if (sessionEpoch.current !== epoch) return;
          // Only a genuine 401 means the session is actually gone — leave
          // an otherwise-valid session alone on a network blip / 5xx and
          // let the next scheduled tick retry.
          if (err?.status === 401) {
            setToken(null);
            clearInterval(refreshTimer.current);
          }
        });
    }, REFRESH_INTERVAL_MS);
  }, []);

  useEffect(() => () => clearInterval(refreshTimer.current), []);

  useEffect(() => {
    const epoch = sessionEpoch.current;
    api.refresh()
      .then(({ token: t }) => {
        if (sessionEpoch.current !== epoch) return;
        setToken(t);
        startRefreshTimer();
      })
      .catch(() => {})
      .finally(() => { if (sessionEpoch.current === epoch) setLoading(false); });
  }, [startRefreshTimer]);

  const login = useCallback(async (password) => {
    const { token: t } = await api.login(password);
    setToken(t);
    startRefreshTimer();
  }, [startRefreshTimer]);

  const logout = useCallback(() => {
    sessionEpoch.current += 1; // invalidate any refresh response still in flight
    clearInterval(refreshTimer.current);
    setToken(null);
    api.logout().catch(() => {}); // best-effort — local state is already cleared either way
  }, []);

  return (
    <AdminCtx.Provider value={{ token, loading, login, logout }}>
      {children}
    </AdminCtx.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminCtx);
