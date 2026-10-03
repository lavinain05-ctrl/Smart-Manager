import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";

import { useAuth } from "./AuthContext";

import {
  subscribeNotifications,
  markNotificationRead as markReadService,
  markAllNotificationsRead as markAllReadService,
} from "../services/notificationService";

import {
  isNotificationSupported,
  getNotificationPermission,
  registerServiceWorker,
  requestNotificationPermission,
  showPhoneNotification,
  sendTestNotification,
  playNotificationSound,
} from "../services/pushNotificationService";
import toast from "react-hot-toast";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [rawNotifications, setRawNotifications] = useState([]);
  const [phonePermission, setPhonePermission] = useState(() => getNotificationPermission());
  const isFirstLoadRef = useRef(true);
  const seenNotificationIdsRef = useRef(new Set());

  // Register service worker on mount and track permission
  useEffect(() => {
    registerServiceWorker();
    setPhonePermission(getNotificationPermission());
  }, []);

  const [localReadIds, setLocalReadIds] = useState(() => {
    if (!user?.uid) return new Set();
    try {
      const saved = localStorage.getItem(`rwa_read_notifs_${user.uid}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Reload localReadIds when user changes
  useEffect(() => {
    if (!user?.uid) {
      setLocalReadIds(new Set());
      return;
    }
    try {
      const saved = localStorage.getItem(`rwa_read_notifs_${user.uid}`);
      setLocalReadIds(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch {
      setLocalReadIds(new Set());
    }
  }, [user?.uid]);

  // Subscribe to notifications (personal + broadcast "all" + user.role)
  useEffect(() => {
    if (!user?.uid) {
      setRawNotifications([]);
      isFirstLoadRef.current = true;
      seenNotificationIdsRef.current.clear();
      return;
    }

    isFirstLoadRef.current = true;

    const unsubscribe = subscribeNotifications(
      user.uid,
      (incoming) => {
        setRawNotifications(incoming);

        if (isFirstLoadRef.current) {
          incoming.forEach((item) => {
            if (item?.id) seenNotificationIdsRef.current.add(item.id);
          });
          isFirstLoadRef.current = false;
        } else {
          incoming.forEach((item) => {
            if (item?.id && !seenNotificationIdsRef.current.has(item.id)) {
              seenNotificationIdsRef.current.add(item.id);

              // CRITICAL: "but not send notification for every collect payment"
              const isPayment =
                item.type === "payment" ||
                (item.title && item.title.toLowerCase().includes("payment")) ||
                (item.title && item.title.toLowerCase().includes("fee paid"));

              if (user?.role === "admin" && isPayment) {
                return;
              }

              // Active phone/browser push notification if permission granted
              if (getNotificationPermission() === "granted") {
                showPhoneNotification(item.title || "D BLOCK RWA Notification", {
                  body: item.message || "New operational update in society portal.",
                  data: {
                    url: item.link || (user?.role === "admin" ? "/admin/dashboard" : "/resident"),
                  },
                });
              }

              // Active notification in Admin Portal for registrations, profile requests, suggestions, complaints, messages, etc.
              if (user?.role === "admin") {
                // Play notification audio chime
                playNotificationSound();

                // Interactive in-app toast alert
                toast((t) => (
                  <div
                    onClick={() => {
                      toast.dismiss(t.id);
                      if (item.link) {
                        window.location.href = item.link;
                      }
                    }}
                    className="flex items-start gap-2.5 cursor-pointer text-left select-none"
                  >
                    <span className="text-xl shrink-0">🔔</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-normal">
                        {item.message}
                      </p>
                      {item.link && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">
                          View details →
                        </span>
                      )}
                    </div>
                  </div>
                ), {
                  duration: 6000,
                  position: "top-right",
                  id: `admin-toast-${item.id}`,
                  style: {
                    borderRadius: "14px",
                    background: "#ffffff",
                    color: "#0f172a",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    border: "1px solid #e2e8f0",
                    padding: "12px 14px",
                    maxWidth: "360px",
                  },
                });
              }
            }
          });
        }
      },
      user.role || "resident"
    );

    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  // Request browser/phone notification bar permission
  const requestPhonePermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPhonePermission(result);
    if (result === "granted") {
      await sendTestNotification();
    }
    return result;
  }, []);

  const triggerTestNotification = useCallback(async () => {
    return await sendTestNotification();
  }, []);

  // Combine Firestore status + local read status for broadcasts, and deduplicate identical notifications
  const notifications = useMemo(() => {
    let list = rawNotifications.map((notif) => {
      const isBroadcast = notif.userId === "all" || notif.userId === user?.role;
      const isReadLocally = localReadIds.has(notif.id);
      const isRead = notif.read || (isBroadcast && isReadLocally);
      return {
        ...notif,
        read: isRead,
      };
    });

    // In admin portal, do not include individual payment collection notifications
    if (user?.role === "admin") {
      list = list.filter((notif) => {
        const isPayment =
          notif.type === "payment" ||
          (notif.title && notif.title.toLowerCase().includes("payment")) ||
          (notif.title && notif.title.toLowerCase().includes("fee paid"));
        return !isPayment;
      });
    }

    const seen = new Set();
    const deduplicated = [];
    for (const notif of list) {
      const titleSig = (notif.title || "").trim().toLowerCase();
      const messageSig = (notif.message || "").trim().toLowerCase();
      const typeSig = (notif.type || "info").toLowerCase();
      const sig = `${titleSig}::${messageSig}::${typeSig}`;

      if (!seen.has(sig)) {
        seen.add(sig);
        deduplicated.push(notif);
      }
    }
    return deduplicated;
  }, [rawNotifications, localReadIds, user?.role]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Unread notification count mapped by route path (e.g. "/admin/complaints": 2)
  const unreadByPath = useMemo(() => {
    const map = {};
    notifications.forEach((n) => {
      if (!n.read && n.link) {
        const cleanPath = n.link.split("?")[0].replace(/\/+$/, "");
        map[cleanPath] = (map[cleanPath] || 0) + 1;
      }
    });
    return map;
  }, [notifications]);

  const markRead = useCallback(async (id) => {
    const target = rawNotifications.find((n) => n.id === id);
    if (!target) return;

    // Find all raw notifications with identical title & message to mark all matching duplicates read together
    const titleSig = (target.title || "").trim().toLowerCase();
    const messageSig = (target.message || "").trim().toLowerCase();
    const matchingNotifs = rawNotifications.filter((n) => {
      return (
        n.id === id ||
        ((n.title || "").trim().toLowerCase() === titleSig &&
         (n.message || "").trim().toLowerCase() === messageSig)
      );
    });

    const idsToMark = matchingNotifs.map((n) => n.id);

    // Update local read state immediately
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      idsToMark.forEach((mId) => next.add(mId));
      if (user?.uid) {
        try {
          localStorage.setItem(
            `rwa_read_notifs_${user.uid}`,
            JSON.stringify(Array.from(next))
          );
        } catch (e) {
          console.warn("Could not save read notif to localStorage", e);
        }
      }
      return next;
    });

    // If personal notifications, update Firestore
    for (const notif of matchingNotifs) {
      if (notif.userId === user?.uid) {
        markReadService(notif.id).catch((err) => {
          console.error("Failed to mark personal notification read:", err);
        });
      }
    }
  }, [rawNotifications, user]);

  const markAllRead = useCallback(async () => {
    if (!user?.uid) return;

    // Mark all current notifications as read locally
    const allIds = rawNotifications.map((n) => n.id);
    setLocalReadIds(new Set(allIds));
    try {
      localStorage.setItem(
        `rwa_read_notifs_${user.uid}`,
        JSON.stringify(allIds)
      );
    } catch (e) {
      console.warn("Could not sync all read notifs to localStorage", e);
    }

    // Mark all personal in Firestore
    try {
      await markAllReadService(user.uid);
    } catch (err) {
      console.error("Failed to mark all personal notifications read:", err);
    }
  }, [rawNotifications, user]);

  const markPathRead = useCallback(async (path) => {
    if (!path) return;
    const cleanTarget = path.split("?")[0].replace(/\/+$/, "");
    const matching = notifications.filter((n) => {
      if (n.read || !n.link) return false;
      const cleanLink = n.link.split("?")[0].replace(/\/+$/, "");
      return cleanLink === cleanTarget;
    });

    for (const m of matching) {
      markRead(m.id);
    }
  }, [notifications, markRead]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadByPath,
        markPathRead,
        markRead,
        markAllRead,
        phonePermission,
        requestPhonePermission,
        triggerTestNotification,
        showPhoneNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

