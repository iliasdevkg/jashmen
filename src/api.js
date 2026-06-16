const B = '/admin/api';

async function req(method, path, body, token) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ката ${res.status}`);
  return data;
}

export const fetchContent = () => req('GET', '/public/content');
export const fetchLeaderboard = (n = 50) => req('GET', `/u/leaderboard?limit=${n}`);
export const apiLogin = (email, password) => req('POST', '/u/login', { email, password });
export const apiSignup = (name, email, password, avatar) =>
  req('POST', '/u/signup', { name, email, password, avatar });
export const fetchMe = (token) => req('GET', '/u/me', null, token);
export const claimDaily = (token) => req('POST', '/u/me/daily', null, token);
export const completeLesson = (token, lessonId, mistakes, isReview) =>
  req('POST', '/u/me/lesson', { lessonId, mistakes, isReview }, token);
export const buyItem = (token, itemId, price, kind) =>
  req('POST', '/u/me/buy', { itemId, price, kind }, token);
export const patchState = (token, patch) =>
  req('PATCH', '/u/me/state', patch, token);
