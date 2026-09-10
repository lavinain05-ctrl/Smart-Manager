import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeActivities,
  addActivity as addActivityService,
  updateActivity as updateActivityService,
  deleteActivity as deleteActivityService,
} from "../services/activityService";

import { createBulkNotifications } from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { useResidents } from "./ResidentContext";

const ActivityContext = createContext();

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const { user } = useAuth();
  const { residents } = useResidents();

  useEffect(() => {
    if (!user) {
      setActivities([]);
      return;
    }

    const unsubscribe = subscribeActivities(setActivities);
    return () => unsubscribe();
  }, [user?.uid]);

  async function addActivity(data) {
    try {
      await addActivityService(data);

      // Send notification to all approved residents
      const residentIds = (residents || [])
        .filter((r) => r.status !== "Inactive" && r.status !== "inactive")
        .map((r) => r.id)
        .filter(Boolean);

      if (residentIds.length > 0) {
        createBulkNotifications({
          userIds: residentIds,
          title: `🎯 ${data.title || "New Activity"}`,
          message: data.description?.slice(0, 200) || "A new activity has been announced.",
          type: "info",
          link: "/resident/activities",
        }).catch((err) => console.error("[ActivityContext] Bulk notification error:", err));
      }

      toast.success("Activity Created");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to create activity");
      return false;
    }
  }

  async function updateActivity(id, data) {
    try {
      await updateActivityService(id, data);
      toast.success("Activity Updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update activity");
      return false;
    }
  }

  async function deleteActivity(id) {
    try {
      await deleteActivityService(id);
      toast.success("Activity Deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete activity");
    }
  }

  return (
    <ActivityContext.Provider
      value={{
        activities,
        addActivity,
        updateActivity,
        deleteActivity,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivities() {
  return useContext(ActivityContext);
}
