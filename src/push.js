// src/push.js — real browser Web Push (Push API + Service Worker), no
// third-party SDK. Backs the manifest's streak-reminder notifications.
import * as api from './api.js';

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

// Push subscription keys are delivered as URL-safe base64; PushManager
// wants a raw Uint8Array — this is the standard conversion everyone doing
// Web Push writes once and copies forever.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush(token) {
  if (!isPushSupported()) throw new Error('Бул браузер эскертмелерди колдобойт');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Эскертмелерге уруксат берилген жок');

  const { publicKey } = await api.fetchPushPublicKey();
  if (!publicKey) throw new Error('Push эскертмелери учурда өчүрүлгөн');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.subscribePush(token, sub.toJSON());
  return sub;
}

export async function unsubscribeFromPush(token) {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.unsubscribePush(token, sub.endpoint).catch(() => {}); // best-effort — unsubscribe locally either way
  await sub.unsubscribe();
}
