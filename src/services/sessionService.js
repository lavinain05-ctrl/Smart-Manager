import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase/firebase";
import { getClientDeviceInfo } from "./loginTrackerService";

const sessionsRef = collection(db, "activeSessions");

/**
 * Get or create a persistent unique Session ID for this browser / device
 */
export function startNewSessionId() {
  const newId = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem("rwa_active_session_id", newId);
    localStorage.setItem("rwa_session_login_time", Date.now().toString());
  }
  return newId;
}

export function resetSessionId() {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.removeItem("rwa_active_session_id");
    localStorage.removeItem("rwa_session_login_time");
  }
}

export function getOrCreateSessionId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return "sess_" + Math.random().toString(36).substring(2, 15);
  }
  let id = localStorage.getItem("rwa_active_session_id");
  if (!id) {
    id = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("rwa_active_session_id", id);
    localStorage.setItem("rwa_session_login_time", Date.now().toString());
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

    // If document already exists, check if it was revoked
    let wasRevoked = false;
    let existingCreatedAt = null;
    try {
      const existingSnap = await getDoc(sessionDocRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        existingCreatedAt = existingData.createdAt || null;
        if (existingData.isActive === false && existingData.revokedReason && existingData.revokedReason !== "User signed out") {
          wasRevoked = true;
          console.warn("[SessionService] Device session was revoked:", existingData.revokedReason);
          return sessionId;
        }
      }
    } catch {
      // Non-fatal if getDoc fails
    }

    if (!wasRevoked) {
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
          revokedAt: null,
          lastActiveAt: serverTimestamp(),
          createdAt: existingCreatedAt || serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (typeof window !== "undefined" && window.localStorage) {
      if (!localStorage.getItem("rwa_session_login_time")) {
        localStorage.setItem("rwa_session_login_time", Date.now().toString());
      }
    }

    return sessionId;
  } catch (error) {
    if (error.code !== "permission-denied" && error.code !== "PERMISSION_DENIED") {
      console.warn("[SessionService] Failed to init device session:", error.message);
    }
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
 * If another device or administrator revokes this session (isActive == false),
 * fire onRevoked callback to log the device out.
 * Local sign-outs ("User signed out") are ignored to prevent self-revocation loops.
 */
export function subscribeCurrentSession(sessionId, onRevoked) {
  if (!sessionId) return () => {};

  const listenerStartTime = Date.now();
  const sessionDocRef = doc(db, "activeSessions", sessionId);

  return onSnapshot(
    sessionDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isActive === false) {
          // Ignore local user logout actions
          if (data.revokedReason === "User signed out") {
            return;
          }

          const revokedTime = data.revokedAt?.toMillis
            ? data.revokedAt.toMillis()
            : data.revokedAt ? new Date(data.revokedAt).getTime() : 0;

          const createdAtTime = data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : data.createdAt ? new Date(data.createdAt).getTime() : 0;

          // If this session document was explicitly created AFTER the revocation, ignore stale revocation
          if (revokedTime && createdAtTime && createdAtTime > revokedTime) {
            console.log("[SessionService] Session was created after revocation, ignoring old revoke");
            return;
          }

          onRevoked(data.revokedReason || "You have been logged out from this device.");
        }
      }
    },
    (error) => {
      if (error.code !== "permission-denied" && error.code !== "PERMISSION_DENIED") {
        console.warn("[SessionService] Current session listener error:", error.message);
      }
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
  // If user is not authenticated in Firebase Auth, skip writing to activeSessions (rules require isSignedIn)
  if (!auth.currentUser) return;
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
    if (err.code !== "permission-denied" && err.code !== "PERMISSION_DENIED") {
      console.warn("[SessionService] terminateSession warning:", err.message);
    }
  }
}

/**
 * Terminate all other device sessions for a user (e.g. on password change or admin action)
 */
export async function terminateAllOtherSessions(
  uid,
  keepSessionId = null,
  reason = "Your password was changed. You were logged out from other devices."
) {
  if (!uid) return;

  // 1. Immediately update current device's local session timestamp so this device is preserved
  if (keepSessionId && typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem("rwa_session_login_time", (Date.now() + 5000).toString());
  }

  // 2. Set passwordChangedAt on users/{uid} in Firestore
  // This acts as a real-time signal for any active listener on any connected device!
  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(
      userDocRef,
      {
        passwordChangedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[SessionService] Failed to set passwordChangedAt on user:", err.message);
  }

  // 3. Invalidate activeSessions docs for this user
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
