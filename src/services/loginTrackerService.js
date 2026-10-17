import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getOrCreateSessionId } from "./sessionService";

const loginsRef = collection(db, "portalLogins");

/**
 * Get client browser, OS, and device information safely
 */
export function getClientDeviceInfo() {
  if (typeof window === "undefined" || !window.navigator) {
    return {
      browser: "Unknown",
      os: "Unknown",
      device: "Desktop",
      screen: "Unknown",
    };
  }

  const ua = window.navigator.userAgent || "";
  let browser = "Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) os = "iOS";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  let device = "Desktop";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    device = "Mobile";
  } else if (/iPad|Tablet/i.test(ua)) {
    device = "Tablet";
  }

  const screenResolution =
    typeof screen !== "undefined"
      ? `${screen.width}x${screen.height}`
      : "Unknown";

  const model = parseDeviceModel(ua, screenResolution, os, device);
  let customName = "";
  if (typeof window !== "undefined" && window.localStorage) {
    customName = localStorage.getItem("rwa_device_custom_name") || "";
  }

  return {
    browser,
    os,
    device,
    screen: screenResolution,
    model,
    deviceName: customName || model,
  };
}

/**
 * Intelligent hardware device and model parser
 * Extracts exact phone / computer model from User-Agent and screen resolution
 */
export function parseDeviceModel(ua = "", screenRes = "", os = "", device = "") {
  if (!ua) {
    if (os === "Windows") return "Windows PC / Laptop";
    if (os === "iOS") return "Apple iPhone";
    if (os === "Android") return "Android Mobile";
    if (os === "macOS") return "Apple MacBook / Mac";
    return device ? `${device} Device` : "Personal Computer";
  }

  // 1. Android devices: format is "... Android [version]; [Model] Build/..."
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s+[\d.]+;\s*([^;)]+)/i);
    if (match && match[1]) {
      let raw = match[1].trim();
      raw = raw.split(/\s*Build\//i)[0].trim();
      raw = raw.replace(/;\s*wv/i, "").trim();

      if (/^SM-[A-Z0-9]+/i.test(raw)) {
        return `Samsung Galaxy (${raw})`;
      }
      if (/Pixel/i.test(raw)) {
        return `Google ${raw}`;
      }
      if (/^CPH|^PGAM|^PEX/i.test(raw)) {
        return `OnePlus / Oppo (${raw})`;
      }
      if (/^RMX/i.test(raw)) {
        return `Realme (${raw})`;
      }
      if (/^M2|^Redmi|^Xiaomi|^POCO/i.test(raw)) {
        return `Xiaomi / Redmi (${raw})`;
      }
      if (/^V2|^vivo/i.test(raw)) {
        return `Vivo (${raw})`;
      }
      if (/^moto/i.test(raw)) {
        return `Motorola (${raw})`;
      }
      if (raw && raw !== "K" && raw.length > 1) {
        return raw;
      }
    }
    return "Android Smartphone";
  }

  // 2. Apple iOS devices (iPhone & iPad)
  if (/iPhone/i.test(ua)) {
    if (screenRes) {
      if (screenRes.includes("393x852") || screenRes.includes("390x844")) return "Apple iPhone 14 / 15 / 16";
      if (screenRes.includes("430x932") || screenRes.includes("428x926")) return "Apple iPhone Pro Max / Plus";
      if (screenRes.includes("375x812")) return "Apple iPhone X / 11 Pro / 12 Mini";
      if (screenRes.includes("414x896")) return "Apple iPhone 11 / XR / XS Max";
    }
    return "Apple iPhone";
  }

  if (/iPad/i.test(ua)) {
    return "Apple iPad";
  }

  // 3. Apple Mac
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return "Apple MacBook / Mac";
  }

  // 4. Windows
  if (/Windows/i.test(ua)) {
    return "Windows Laptop / PC";
  }

  // 5. Chromebook
  if (/CrOS/i.test(ua)) {
    return "Google Chromebook";
  }

  // 6. Linux
  if (/Linux/i.test(ua)) {
    return "Linux Workstation";
  }

  return `${os || "Computer"} (${device || "Desktop"})`;
}

/**
 * Map user role to human-readable Portal name
 */
export function getPortalFromRole(role) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "Admin Portal";
    case "collector":
      return "Collector Portal";
    case "resident":
      return "Resident Portal";
    case "family":
      return "Family Portal";
    case "committee":
      return "Committee Portal";
    case "guard":
    case "security":
      return "Security Guard Portal";
    default:
      return "User Portal";
  }
}

/**
 * Sanitize an identifier to ensure clean mobile numbers are stored
 * (strips synthetic @...firebaseapp.com suffixes)
 */
export function cleanUserIdentifier(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  if (str.includes("@smart-manager-aad4d.firebaseapp.com")) {
    str = str.replace(/@smart-manager-aad4d\.firebaseapp\.com$/i, "");
  } else if (/^(\d{10})@[^.]+\.firebaseapp\.com$/i.test(str)) {
    str = str.replace(/@[^.]+\.firebaseapp\.com$/i, "");
  }
  return str;
}

/**
 * Record a login event (success or failed attempt)
 */
export async function recordLoginEvent({
  uid = "",
  name = "",
  identifier = "",
  role = "",
  portal = "",
  status = "success",
  error = "",
  extra = {},
}) {
  try {
    const deviceInfo = getClientDeviceInfo();
    const resolvedPortal = portal || getPortalFromRole(role);
    const sanitizedId = cleanUserIdentifier(identifier);
    const sessionId = getOrCreateSessionId();

    await addDoc(loginsRef, {
      sessionId,
      uid: uid || "",
      name: name || "User",
      identifier: sanitizedId || "",
      role: (role || "resident").toLowerCase(),
      portal: resolvedPortal,
      status, // "success" | "failed"
      error: error || "",
      device: deviceInfo.device,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      screen: deviceInfo.screen,
      model: deviceInfo.model,
      deviceName: deviceInfo.deviceName,
      createdAt: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
      ...extra,
    });
  } catch (err) {
    // Non-blocking logging: never break user login flow
    console.warn("[LoginTracker] Failed to record login session:", err.message);
  }
}

/**
 * Ensure an active session is recorded for the currently logged-in user.
 * Avoids duplicate flood by caching in sessionStorage per tab/day.
 */
export async function ensureActiveSessionLogged(user) {
  if (!user || !user.uid) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionKey = `logged_active_session_${user.uid}_${todayKey}`;

  if (typeof window !== "undefined" && window.sessionStorage) {
    if (sessionStorage.getItem(sessionKey)) {
      return; // Already recorded in this tab today
    }
    sessionStorage.setItem(sessionKey, "1");
  }

  try {
    const resolvedRole = user.role || "resident";
    const displayName =
      user.name ||
      (resolvedRole === "admin" ? "Admin" : resolvedRole === "collector" ? "Collector" : "User");

    const rawId = user.mobile || user.phone || user.email || user.uid;
    const sanitizedId = cleanUserIdentifier(rawId);

    await recordLoginEvent({
      uid: user.uid,
      name: displayName,
      identifier: sanitizedId,
      role: resolvedRole,
      portal: getPortalFromRole(resolvedRole),
      status: "success",
      extra: {
        flat: user.flat || user.flatNumber || "",
        block: user.block || "",
        isSessionRestore: true,
      },
    });
  } catch (err) {
    console.warn("[LoginTracker] ensureActiveSessionLogged skipped:", err.message);
  }
}

/**
 * Subscribe to recent login events in real time
 */
export function subscribeLoginHistory(callback, maxLimit = 200) {
  const q = query(loginsRef, limit(maxLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort client-side by createdAt / clientTimestamp desc (avoids missing composite index errors)
      records.sort((a, b) => {
        const timeA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : a.clientTimestamp
          ? new Date(a.clientTimestamp).getTime()
          : 0;
        const timeB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : b.clientTimestamp
          ? new Date(b.clientTimestamp).getTime()
          : 0;
        return timeB - timeA;
      });

      callback(records);
    },
    (error) => {
      console.warn("[LoginTracker] Snapshot listener error:", error.message);
    }
  );
}
