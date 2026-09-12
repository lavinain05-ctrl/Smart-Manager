import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";

import { useAuth } from "./AuthContext";

import {
  subscribeNotifications,
  markNotificationRead as markReadService,
  markAllNotificationsRead as markAllReadService,
} from "../services/notificationService";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [rawNotifications, setRawNotifications] = useState([]);
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
      return;
    }

    const unsubscribe = subscribeNotifications(
      user.uid,
      setRawNotifications,
      user.role || "resident"
    );
    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  // Combine Firestore status + local read status for broadcasts
  const notifications = useMemo(() => {
    return rawNotifications.map((notif) => {
      const isBroadcast = notif.userId === "all" || notif.userId === user?.role;
      const isReadLocally = localReadIds.has(notif.id);
      const isRead = notif.read || (isBroadcast && isReadLocally);
      return {
        ...notif,
        read: isRead,
      };
    });
  }, [rawNotifications, localReadIds, user?.role]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const markRead = useCallback(async (id) => {
    const target = rawNotifications.find((n) => n.id === id);
    if (!target) return;

    // Update local read state immediately
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
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

    // If it's a personal notification, update Firestore
    if (target.userId === user?.uid) {
      try {
        await markReadService(id);
      } catch (err) {
        console.error("Failed to mark personal notification read:", err);
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

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
