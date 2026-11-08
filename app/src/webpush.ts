// Web Push för webbappen (PWA). Motsvarar src/push.ts i den native appen.
// Prenumerationen skickas till backend (Neon via API på Vercel) och används när tränaren skickar en notis.
// På iPhone fungerar Web Push bara när appen lagts till på hemskärmen (iOS 16.4 eller senare).
import { Platform } from 'react-native';

// Publik VAPID-nyckel, genereras en gång för backend (till exempel med `npx web-push generate-vapid-keys`).
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type WebPushStatus = 'unsupported' | 'needs-install' | 'denied' | 'subscribed';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function webPushSupport(): WebPushStatus | 'available' {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'available';
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Måste anropas från ett knapptryck (krav i Safari). Returnerar prenumerationen som JSON för backend. */
export async function subscribeWebPush(): Promise<PushSubscriptionJSON | null> {
  if (webPushSupport() !== 'available' || !VAPID_PUBLIC_KEY) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  return sub.toJSON();
}
