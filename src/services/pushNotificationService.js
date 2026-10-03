/**
 * Push Notification Service
 * Manages phone notification bar alerts and browser Web Notifications.
 */

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isServiceWorkerSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

/**
 * Register Service Worker for PWA offline caching and status bar notifications
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
  if (!isNotificationSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn("[Notifications] Permission request error:", error);
    return "denied";
  }
}

/**
 * Displays an alert directly in the phone / OS notification bar
 */
export async function showPhoneNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const defaultOptions = {
    icon: "/icon-192.png?v=10",
    badge: "/badge-96.png?v=10",
    vibrate: [100, 50, 100],
    ...options,
  };

  try {
    // Prefer service worker for Android status bar persistence
    if (isServiceWorkerSupported()) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, defaultOptions);
        return true;
      }
    }

    // Fallback to desktop/standard Notification API
    new Notification(title, defaultOptions);
    return true;
  } catch (error) {
    console.warn("[Notifications] showPhoneNotification error:", error);
    return false;
  }
}

export async function sendTestNotification() {
  playNotificationSound();
  return await showPhoneNotification("D BLOCK RWA Indraprastha", {
    body: "Phone notification bar is active! You will receive operational and society alerts.",
  });
}

/**
 * Play a crisp, gentle audio chime using Web Audio API (zero external assets needed).
 */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Pleasant dual-chime harmonic (D5: 587.33Hz -> A5: 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Autoplay restrictions or audio context errors are caught gracefully
  }
}
