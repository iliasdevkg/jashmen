import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from './api.js';

const TOKEN_KEY = 'fl_user_token';
const BRIGHT_KEY = 'fl_bright';
const AuthCtx = createContext(null);
const ContentCtx = createContext(null);
const BrightCtx = createContext(null);

export function StoreProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [bright, setBrightRaw] = useState(() => localStorage.getItem(BRIGHT_KEY) === '1');

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

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    api.fetchMe(token)
      .then(u => {
        setUser(u);
        setLoading(false);
        api.claimDaily(token).then(({ user: u2 }) => setUser(u2)).catch(() => {});
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setLoading(false);
      });
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { token: t, user: u } = await api.apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    api.claimDaily(t).then(({ user: u2 }) => setUser(u2)).catch(() => {});
    return u;
  }, []);

  const signup = useCallback(async (name, email, password, avatar) => {
    const { token: t, user: u } = await api.apiSignup(name, email, password, avatar);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    api.claimDaily(t).then(({ user: u2 }) => setUser(u2)).catch(() => {});
    return u;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
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
