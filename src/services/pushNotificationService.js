/**
 * Push Notification Service
 * Status bar push notifications are disabled to prevent Android Chrome from showing "Possible spam" warnings.
 * Notifications are cleanly managed inside the app (Notification Bell, badge counts, real-time list).
 */

export function isNotificationSupported() {
  return false;
}

export function isServiceWorkerSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function getNotificationPermission() {
  return "default";
}

/**
 * Register Service Worker for PWA offline caching only (no push notification spam)
 */
export async function registerServiceWorker() {
  if (!isServiceWorkerSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.warn("[SW] Registration error:", error);
    return null;
  }
}

export async function requestNotificationPermission() {
  return "default";
}

/**
 * Disabled: returns false so no phone notification bar alert is pushed to Android system
 */
export async function showPhoneNotification() {
  return false;
}

export async function sendTestNotification() {
  return false;
}
