// admin-src/api.js — thin client for /admin/api/admin/*. Separate from the
// main app's src/api.js on purpose: different base path, different token
// (admin JWT, never the user JWT), and admin-only endpoints.

const B = '/admin/api/admin';

// `credentials: 'include'` — the admin refresh-token cookie (httpOnly,
// set by /login and /refresh) rides on every call; the short-lived admin
// access token stays in memory (store.jsx) and goes as the usual
// Authorization header.
async function req(method, path, body, token) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${B}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : (isForm ? body : JSON.stringify(body)),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Ката ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const login = (password) => req('POST', '/login', { password });
// Silently exchanges the httpOnly admin-refresh cookie for a fresh access
// token — no live session means a 401, nothing more.
export const refresh = () => req('POST', '/refresh');
// Real server-side logout — revokes the session and clears the cookie.
export const logout = () => req('POST', '/logout');
export const fetchContent = (token) => req('GET', '/content', null, token);

export const createModule = (token, body) => req('POST', '/modules', body, token);
export const updateModule = (token, id, body) => req('PUT', `/modules/${id}`, body, token);
export const deleteModule = (token, id) => req('DELETE', `/modules/${id}`, null, token);

export const createLesson = (token, moduleId, body) => req('POST', `/modules/${moduleId}/lessons`, body, token);
export const updateLesson = (token, id, body) => req('PUT', `/lessons/${id}`, body, token);
export const deleteLesson = (token, id) => req('DELETE', `/lessons/${id}`, null, token);

export const createPartner = (token, body) => req('POST', '/partners', body, token);
export const updatePartner = (token, id, body) => req('PUT', `/partners/${id}`, body, token);
export const deletePartner = (token, id) => req('DELETE', `/partners/${id}`, null, token);

export const createPrize = (token, body) => req('POST', '/prizes', body, token);
export const updatePrize = (token, id, body) => req('PUT', `/prizes/${id}`, body, token);
export const deletePrize = (token, id) => req('DELETE', `/prizes/${id}`, null, token);

export const fetchLimits = (token) => req('GET', '/limits', null, token);
export const saveLimits = (token, body) => req('PUT', '/limits', body, token);

export const createLeague = (token, body) => req('POST', '/leagues', body, token);
export const updateLeague = (token, id, body) => req('PUT', `/leagues/${id}`, body, token);
export const deleteLeague = (token, id) => req('DELETE', `/leagues/${id}`, null, token);

export const createAchievement = (token, body) => req('POST', '/achievements', body, token);
export const updateAchievement = (token, id, body) => req('PUT', `/achievements/${id}`, body, token);
export const deleteAchievement = (token, id) => req('DELETE', `/achievements/${id}`, null, token);

export const fetchFunnel  = (token) => req('GET', '/analytics/funnel', null, token);
export const fetchHeatmap = (token) => req('GET', '/analytics/heatmap', null, token);

export async function uploadMedia(token, file) {
  const form = new FormData();
  form.append('file', file);
  return req('POST', '/media/upload', form, token);
}
