import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeNotices,
  addNotice as addNoticeService,
  updateNotice as updateNoticeService,
  deleteNotice as deleteNoticeService,
} from "../services/noticeService";

import { createBulkNotifications } from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { useResidents } from "./ResidentContext";
import { useCommittee } from "./CommitteeContext";

const NoticeContext = createContext();

export function NoticeProvider({ children }) {
  const [notices, setNotices] = useState([]);
  const { user } = useAuth();
  const { residents } = useResidents();
  const { committee } = useCommittee();

  useEffect(() => {
    if (!user) {
      setNotices([]);
      return;
    }

    const unsubscribe = subscribeNotices((data) => {
      setNotices(data);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // =============================
  // Audience-filtered notices
  // Admin sees all. Others see based on audience + role.
  // Old docs without audience → treated as ["all_residents"]
  // =============================

  const filteredNotices = useMemo(() => {
    if (!user) return [];

    // Admin sees everything
    if (user.role === "admin") return notices;

    return notices.filter((notice) => {
      const audience = notice.audience || ["all_residents"];

      if (audience.includes("all_residents")) return true;

      if (
        audience.includes("committee_only") &&
        (user.role === "committee")
      ) {
        return true;
      }

      return false;
    });
  }, [notices, user]);

  async function addNotice(data) {
    try {
      await addNoticeService(data);

      // Audience-aware notifications
      const audience = data.audience || ["all_residents"];

      const residentIds = new Set();

      if (audience.includes("all_residents")) {
        // Notify all active residents
        (residents || [])
          .filter((r) => r.status !== "Inactive" && r.status !== "inactive")
          .forEach((r) => { if (r.id) residentIds.add(r.id); });
      }

      if (audience.includes("committee_only")) {
        // Notify committee member UIDs
        (committee || []).forEach((m) => {
          if (m.uid) residentIds.add(m.uid);
          if (m.id) residentIds.add(m.id);
        });
      }

      // Public-only → no in-app notifications (external sharing)
      if (residentIds.size > 0) {
        createBulkNotifications({
          userIds: [...residentIds],
          title: `📢 ${data.title || "New Notice"}`,
          message: (data.body || "").slice(0, 200) || "A new notice has been published.",
          type: "info",
          link: "/resident/notices",
        }).catch((err) => console.error("[NoticeContext] Bulk notification error:", err));
      }

      toast.success("Notice Published Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish notice");
      return false;
    }
  }

  async function updateNotice(id, data) {
    try {
      await updateNoticeService(id, data);
      toast.success("Notice Updated Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update notice");
      return false;
    }
  }

  async function deleteNotice(id) {
    try {
      await deleteNoticeService(id);
      toast.success("Notice Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete notice");
    }
  }

  return (
    <NoticeContext.Provider
      value={{
        notices: filteredNotices,
        allNotices: notices,
        addNotice,
        updateNotice,
        deleteNotice,
      }}
    >
      {children}
    </NoticeContext.Provider>
  );
}

export function useNotices() {
  return useContext(NoticeContext);
}
