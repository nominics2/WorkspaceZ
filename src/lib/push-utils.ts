/**
 * Utility functions for Web Push API interactions.
 */

/**
 * Converts a base64 VAPID public key to a Uint8Array for PushManager subscription.
 */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Gets device and platform information for push subscription metadata.
 */
export function getPlatformInfo() {
  if (typeof window === 'undefined') return { userAgent: '', platform: '' };
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as any).userAgentData?.platform || navigator.platform || 'unknown'
  };
}
