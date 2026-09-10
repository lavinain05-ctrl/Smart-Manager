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

  return {
    browser,
    os,
    device,
    screen: screenResolution,
  };
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

    await addDoc(loginsRef, {
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
