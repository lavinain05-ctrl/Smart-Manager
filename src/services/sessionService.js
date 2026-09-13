import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getClientDeviceInfo } from "./loginTrackerService";

const sessionsRef = collection(db, "activeSessions");

/**
 * Get or create a persistent unique Session ID for this browser / device
 */
export function getOrCreateSessionId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return "sess_" + Math.random().toString(36).substring(2, 15);
  }
  let id = localStorage.getItem("rwa_active_session_id");
  if (!id) {
    id = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("rwa_active_session_id", id);
  }
  return id;
}

/**
 * Register or update the active session for the current device
 */
export async function initDeviceSession(user) {
  if (!user || !user.uid) return null;

  try {
    const sessionId = getOrCreateSessionId();
    const deviceInfo = getClientDeviceInfo();
    const sessionDocRef = doc(db, "activeSessions", sessionId);

    await setDoc(
      sessionDocRef,
      {
        sessionId,
        uid: user.uid,
        userName: user.name || "User",
        userEmail: user.email || user.phone || "",
        userRole: (user.role || "resident").toLowerCase(),
        device: deviceInfo.device, // "Desktop" | "Mobile" | "Tablet"
        os: deviceInfo.os,         // "Windows" | "macOS" | "Android" | "iOS" | "Linux"
        browser: deviceInfo.browser, // "Chrome" | "Edge" | "Firefox" | "Safari"
        screen: deviceInfo.screen,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        isActive: true,
        revokedReason: "",
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return sessionId;
  } catch (error) {
    console.warn("[SessionService] Failed to init device session:", error.message);
    return null;
  }
}

/**
 * Touch session to update last active timestamp
 */
export async function touchSession(sessionId) {
  if (!sessionId) return;
  try {
    const sessionDocRef = doc(db, "activeSessions", sessionId);
    await updateDoc(sessionDocRef, {
      lastActiveAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Listen to current device's session.
 * If another device or password change revokes this session (isActive == false),
 * immediately fire onRevoked callback to log the device out.
 */
export function subscribeCurrentSession(sessionId, onRevoked) {
  if (!sessionId) return () => {};

  const sessionDocRef = doc(db, "activeSessions", sessionId);

  return onSnapshot(
    sessionDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isActive === false) {
          onRevoked(data.revokedReason || "You have been logged out from this device.");
        }
      }
    },
    (error) => {
      console.warn("[SessionService] Current session listener error:", error.message);
    }
  );
}

/**
 * Subscribe to all active sessions for a user in real-time.
 * Used in Admin Portal to monitor all logged-in devices.
 */
export function subscribeUserActiveSessions(uid, callback) {
  if (!uid) {
    if (callback) callback([]);
    return () => {};
  }

  const currentSessionId = getOrCreateSessionId();
  const deviceInfo = getClientDeviceInfo();

  // Query only by uid to avoid any composite index requirements in Firestore
  const q = query(sessionsRef, where("uid", "==", uid));

  return onSnapshot(
    q,
    (snapshot) => {
      let list = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            isCurrentDevice: data.sessionId === currentSessionId || d.id === currentSessionId,
          };
        })
        .filter((s) => s.isActive !== false);

      // Ensure current device is present in list
      const hasCurrent = list.some((s) => s.isCurrentDevice);
      if (!hasCurrent) {
        list.unshift({
          id: currentSessionId,
          sessionId: currentSessionId,
          uid,
          isCurrentDevice: true,
          isActive: true,
          device: deviceInfo.device,
          os: deviceInfo.os,
          browser: deviceInfo.browser,
          screen: deviceInfo.screen,
          lastActiveAt: new Date(),
          createdAt: new Date(),
        });
      }

      // Sort client-side: current device first, then by lastActiveAt descending
      list.sort((a, b) => {
        if (a.isCurrentDevice) return -1;
        if (b.isCurrentDevice) return 1;

        const timeA = a.lastActiveAt?.toDate
          ? a.lastActiveAt.toDate().getTime()
          : a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : 0;
        const timeB = b.lastActiveAt?.toDate
          ? b.lastActiveAt.toDate().getTime()
          : b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : 0;

        return timeB - timeA;
      });

      if (callback) callback(list);
    },
    (error) => {
      console.warn("[SessionService] User sessions listener fallback:", error.message);
      // Fallback: Return current device session so UI never hangs
      if (callback) {
        callback([
          {
            id: currentSessionId,
            sessionId: currentSessionId,
            uid,
            isCurrentDevice: true,
            isActive: true,
            device: deviceInfo.device,
            os: deviceInfo.os,
            browser: deviceInfo.browser,
            screen: deviceInfo.screen,
            lastActiveAt: new Date(),
            createdAt: new Date(),
          },
        ]);
      }
    }
  );
}

/**
 * Terminate/logout a specific device session
 */
export async function terminateSession(sessionId, reason = "Logged out by administrator") {
  if (!sessionId) return;
  try {
    const sessionDocRef = doc(db, "activeSessions", sessionId);
    await setDoc(
      sessionDocRef,
      {
        isActive: false,
        revokedAt: serverTimestamp(),
        revokedReason: reason,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[SessionService] terminateSession warning:", err.message);
  }
}

/**
 * Terminate all other device sessions for a user (e.g. on password change or admin action)
 */
export async function terminateAllOtherSessions(
  uid,
  keepSessionId = null,
  reason = "Logged out because password was changed"
) {
  if (!uid) return;

  try {
    const q = query(sessionsRef, where("uid", "==", uid));
    const snap = await getDocs(q);
    const updates = [];

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isActive !== false) {
        if (!keepSessionId || (data.sessionId !== keepSessionId && docSnap.id !== keepSessionId)) {
          updates.push(
            setDoc(
              docSnap.ref,
              {
                isActive: false,
                revokedAt: serverTimestamp(),
                revokedReason: reason,
              },
              { merge: true }
            )
          );
        }
      }
    });

    await Promise.all(updates);
  } catch (error) {
    console.warn("[SessionService] Failed to terminate other sessions:", error.message);
  }
}
