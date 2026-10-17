import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  limit,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getOrCreateSessionId } from "./sessionService";
import { getClientDeviceInfo, cleanUserIdentifier, getPortalFromRole } from "./loginTrackerService";

const journeysRef = collection(db, "userJourneys");

/**
 * Friendly page title mapping for all routes across Admin, Resident, Collector, Committee & Public portals
 */
export function getFriendlyPageTitle(pathname = "") {
  const p = (pathname || "").toLowerCase().trim();

  // Resident routes
  if (p === "/resident" || p === "/resident/dashboard") return "Resident Dashboard";
  if (p === "/resident/bills" || p === "/resident/my-bills") return "My Bills & Dues";
  if (p === "/resident/receipts" || p === "/resident/payment-history") return "Payment Receipts";
  if (p === "/resident/notices") return "Notices & Announcements";
  if (p === "/resident/complaints") return "My Complaints";
  if (p === "/resident/suggestions") return "Suggestions & Feedback";
  if (p === "/resident/events") return "Community Events";
  if (p === "/resident/family" || p === "/resident/manage-family") return "Family Members";
  if (p === "/resident/profile") return "My Profile & Settings";
  if (p === "/resident/emergency-contacts" || p === "/resident/emergency") return "Emergency Contacts";
  if (p === "/resident/special-collections") return "Special Collections";

  // Collector routes
  if (p === "/collector" || p === "/collector/dashboard") return "Collector Dashboard";
  if (p === "/collector/collect" || p === "/collector/collection") return "Daily Garbage Collection";
  if (p === "/collector/special-collect") return "Special Campaign Collection";
  if (p === "/collector/history" || p === "/collector/daily-report") return "Collector Collection History";
  if (p === "/collector/residents") return "Collector Resident Directory";
  if (p === "/collector/profile") return "Collector Profile";

  // Admin routes
  if (p === "/admin" || p === "/admin/dashboard") return "Admin Dashboard";
  if (p === "/admin/residents") return "Residents Management";
  if (p === "/admin/garbage-dashboard") return "Garbage Dashboard";
  if (p === "/admin/collections") return "Garbage Collections";
  if (p === "/admin/special-collections") return "Special Collections";
  if (p === "/admin/collectors") return "Garbage Collectors";
  if (p === "/admin/bills") return "Bills Management";
  if (p === "/admin/receipts") return "Receipts Registry";
  if (p === "/admin/payment-history") return "Payment History";
  if (p === "/admin/notices") return "Notices Management";
  if (p === "/admin/complaints") return "Complaints Management";
  if (p === "/admin/suggestions") return "Suggestions Management";
  if (p === "/admin/events") return "Events Management";
  if (p === "/admin/activity-logs") return "Activity & Login Audit";
  if (p === "/admin/devices" || p === "/admin/active-sessions") return "Active Devices & Sessions";
  if (p === "/admin/registration-requests" || p === "/admin/pending-registrations") return "Registration Requests";
  if (p === "/admin/profile-requests") return "Profile Requests";
  if (p === "/admin/committee" || p === "/admin/manage-committee") return "Committee Management";
  if (p === "/admin/blocks" || p === "/admin/blocks-flats") return "Blocks & Flats Setup";
  if (p === "/admin/settings") return "System Settings";
  if (p === "/admin/emergency-contacts") return "Emergency Contacts Setup";

  // Committee routes
  if (p.includes("/committee/dashboard")) return "Committee Dashboard";
  if (p.includes("/committee")) return "Committee Portal";

  // Security guard routes
  if (p.includes("/guard")) return "Security Guard Gate Portal";

  // Auth routes
  if (p === "/" || p === "/login" || p === "/resident/login") return "Login Page";
  if (p === "/register") return "Registration Page";
  if (p === "/forgot-password") return "Forgot Password";
  if (p === "/change-password") return "Change Password";
  if (p === "/pending-approval") return "Pending Approval Screen";

  // Fallback nicely formatted title
  const parts = p.split("/").filter(Boolean);
  if (parts.length > 0) {
    return parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " "))
      .join(" › ");
  }

  return "Home / Portal";
}

/**
 * Format duration in seconds to human-readable string:
 * 12s, 1m 45s, 14m 20s, 1h 05m
 */
export function formatDuration(seconds = 0) {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  if (mins < 60) {
    return remainingSec > 0 ? `${mins}m ${remainingSec}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// In-memory state tracking for active session in this browser tab
let activePageState = {
  pathname: "",
  title: "",
  enteredAtMs: 0,
  enteredAtIso: "",
  sessionId: "",
};

let syncDebounceTimer = null;

/**
 * Update the session journey in Firestore with throttling
 */
async function updateJourneyInFirestore(user, previousVisit = null, currentVisit = null) {
  if (!user || !user.uid) return;

  const sessionId = getOrCreateSessionId();
  const journeyDocRef = doc(db, "userJourneys", sessionId);

  try {
    const deviceInfo = getClientDeviceInfo();
    const role = (user.role || "resident").toLowerCase();
    const cleanId = cleanUserIdentifier(user.mobile || user.phone || user.email || user.uid);

    // Read current journey to append and recalculate total time
    const existingSnap = await getDoc(journeyDocRef);
    let pages = [];
    let totalSeconds = 0;
    let startedAt = null;

    if (existingSnap.exists()) {
      const data = existingSnap.data();
      pages = Array.isArray(data.pages) ? [...data.pages] : [];
      totalSeconds = Number(data.totalDurationSeconds) || 0;
      startedAt = data.startedAt || null;
    }

    // Append the previous completed page visit
    if (previousVisit && previousVisit.durationSeconds > 0) {
      // Avoid micro duplicate writes (< 1 second)
      pages.push(previousVisit);
      // Cap stored pages to the latest 50 to prevent unbounded document growth
      if (pages.length > 50) {
        pages = pages.slice(-50);
      }
      totalSeconds += previousVisit.durationSeconds;
    }

    const payload = {
      sessionId,
      uid: user.uid,
      name: user.name || (role === "admin" ? "Admin" : "User"),
      identifier: cleanId,
      role,
      portal: getPortalFromRole(role),
      flat: user.flat || user.flatNumber || "",
      block: user.block || "",
      device: deviceInfo.device,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      screen: deviceInfo.screen,
      pages,
      pageCount: pages.length + (currentVisit ? 1 : 0),
      totalDurationSeconds: totalSeconds,
      currentPage: currentVisit
        ? {
            path: currentVisit.path,
            title: currentVisit.title,
            enteredAt: currentVisit.enteredAt,
          }
        : null,
      lastActiveAt: serverTimestamp(),
      lastActiveTimestamp: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      isOnline: true,
    };

    if (!startedAt) {
      payload.startedAt = serverTimestamp();
      payload.startedAtTimestamp = new Date().toISOString();
    }

    await setDoc(journeyDocRef, payload, { merge: true });
  } catch (err) {
    // Non-blocking telemetry
    console.warn("[UserJourneyService] Failed to update journey:", err.message);
  }
}

/**
 * Record entering a new page.
 * If user was on a previous page, calculate dwell time and save it.
 */
export function trackPageEnter(user, pathname) {
  if (!user || !user.uid) return;
  if (!pathname) return;

  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  const title = getFriendlyPageTitle(pathname);

  let previousVisit = null;

  // Finalize dwell time on previous page if any
  if (activePageState.pathname && activePageState.enteredAtMs > 0) {
    const durationSeconds = Math.max(1, Math.round((nowMs - activePageState.enteredAtMs) / 1000));
    previousVisit = {
      path: activePageState.pathname,
      title: activePageState.title,
      enteredAt: activePageState.enteredAtIso,
      leftAt: nowIso,
      durationSeconds,
    };
  }

  // Update active page state
  activePageState = {
    pathname,
    title,
    enteredAtMs: nowMs,
    enteredAtIso: nowIso,
    sessionId: getOrCreateSessionId(),
  };

  const currentVisit = {
    path: pathname,
    title,
    enteredAt: nowIso,
  };

  // Debounced push to Firestore to ensure crisp responsiveness
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    updateJourneyInFirestore(user, previousVisit, currentVisit);
  }, 400);
}

/**
 * Flush dwell time when user leaves or closes the tab / browser window
 */
export function flushPageExit(user) {
  if (!user || !user.uid) return;
  if (!activePageState.pathname || activePageState.enteredAtMs === 0) return;

  const nowMs = Date.now();
  const durationSeconds = Math.max(1, Math.round((nowMs - activePageState.enteredAtMs) / 1000));

  const previousVisit = {
    path: activePageState.pathname,
    title: activePageState.title,
    enteredAt: activePageState.enteredAtIso,
    leftAt: new Date().toISOString(),
    durationSeconds,
  };

  // Reset active timer to avoid double counts
  activePageState.enteredAtMs = 0;

  updateJourneyInFirestore(user, previousVisit, null);
}

/**
 * Listen to all user journeys in real-time (for Admin portal)
 */
export function subscribeAllUserJourneys(callback, maxLimit = 100) {
  const q = query(journeysRef, limit(maxLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Sort client-side by last active desc
      records.sort((a, b) => {
        const timeA = a.lastActiveAt?.toDate
          ? a.lastActiveAt.toDate().getTime()
          : a.lastActiveTimestamp
          ? new Date(a.lastActiveTimestamp).getTime()
          : 0;
        const timeB = b.lastActiveAt?.toDate
          ? b.lastActiveAt.toDate().getTime()
          : b.lastActiveTimestamp
          ? new Date(b.lastActiveTimestamp).getTime()
          : 0;
        return timeB - timeA;
      });

      callback(records);
    },
    (err) => {
      console.warn("[UserJourneyService] subscribeAllUserJourneys error:", err.message);
    }
  );
}

/**
 * Subscribe to the journey of a specific session (by sessionId)
 */
export function subscribeJourneyBySessionId(sessionId, callback) {
  if (!sessionId) {
    callback(null);
    return () => {};
  }

  const docRef = doc(db, "userJourneys", sessionId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("[UserJourneyService] subscribeJourneyBySessionId error:", err.message);
      callback(null);
    }
  );
}

/**
 * Query journeys for a specific user UID (in case a user had multiple sessions)
 */
export function subscribeJourneysByUid(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const q = query(journeysRef, where("uid", "==", uid), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const timeA = a.lastActiveAt?.toDate
          ? a.lastActiveAt.toDate().getTime()
          : a.lastActiveTimestamp
          ? new Date(a.lastActiveTimestamp).getTime()
          : 0;
        const timeB = b.lastActiveAt?.toDate
          ? b.lastActiveAt.toDate().getTime()
          : b.lastActiveTimestamp
          ? new Date(b.lastActiveTimestamp).getTime()
          : 0;
        return timeB - timeA;
      });
      callback(list);
    },
    (err) => {
      console.warn("[UserJourneyService] subscribeJourneysByUid error:", err.message);
      callback([]);
    }
  );
}
