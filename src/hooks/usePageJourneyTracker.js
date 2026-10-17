import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageEnter, flushPageExit } from "../services/userJourneyService";

/**
 * Global React Hook that automatically tracks page navigation and dwell time
 * for any authenticated user (Resident, Collector, Committee, Admin).
 */
export function usePageJourneyTracker(user, isImpersonating = false) {
  const location = useLocation();
  const lastPathRef = useRef("");
  const userRef = useRef(user);

  // Keep latest user in ref to prevent stale closures during unload handlers
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Track page change whenever location.pathname changes
  useEffect(() => {
    // Skip tracking simulated impersonation sessions so admin preview doesn't pollute data
    if (isImpersonating) return;
    if (!user?.uid) return;

    const currentPath = location.pathname;
    if (lastPathRef.current === currentPath) return;

    lastPathRef.current = currentPath;
    trackPageEnter(user, currentPath);
  }, [user, location.pathname, isImpersonating]);

  // Heartbeat ticker & unload listeners
  useEffect(() => {
    if (isImpersonating) return;
    if (!user?.uid) return;

    // Heartbeat: periodic refresh every 45 seconds while user is active on page
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === "visible" && userRef.current?.uid) {
        trackPageEnter(userRef.current, location.pathname);
      }
    }, 45000);

    // Flush dwell time when user leaves, hides the tab, or closes browser
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPageExit(userRef.current);
      } else if (document.visibilityState === "visible") {
        trackPageEnter(userRef.current, location.pathname);
      }
    };

    const handleBeforeUnload = () => {
      flushPageExit(userRef.current);
    };

    const handlePageHide = () => {
      flushPageExit(userRef.current);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.uid, location.pathname, isImpersonating]);
}
