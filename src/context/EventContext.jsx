import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeEvents,
  addEvent as addEventService,
  updateEvent as updateEventService,
  deleteEvent as deleteEventService,
  registerForEvent as registerService,
  unregisterFromEvent as unregisterService,
} from "../services/eventService";

import { createBulkNotifications } from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { useResidents } from "./ResidentContext";
import { useCommittee } from "./CommitteeContext";

const EventContext = createContext();

export function EventProvider({ children }) {
  const [events, setEvents] = useState([]);
  const { user } = useAuth();
  const { residents } = useResidents();
  const { committee } = useCommittee();

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const unsubscribe = subscribeEvents((data) => {
      setEvents(data);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // =============================
  // Audience-filtered events
  // =============================

  const filteredEvents = useMemo(() => {
    if (!user) return [];

    // Admin sees everything
    if (user.role === "admin") return events;

    return events.filter((event) => {
      const audience = event.audience || ["all_residents"];

      if (audience.includes("all_residents")) return true;

      if (
        audience.includes("committee_only") &&
        (user.role === "committee")
      ) {
        return true;
      }

      return false;
    });
  }, [events, user]);

  async function addEvent(data) {
    try {
      await addEventService(data);

      // Audience-aware notifications
      const audience = data.audience || ["all_residents"];

      const targetIds = new Set();

      if (audience.includes("all_residents")) {
        (residents || [])
          .filter((r) => r.status !== "Inactive" && r.status !== "inactive")
          .forEach((r) => { if (r.id) targetIds.add(r.id); });
      }

      if (audience.includes("committee_only")) {
        (committee || []).forEach((m) => {
          if (m.uid) targetIds.add(m.uid);
          if (m.id) targetIds.add(m.id);
        });
      }

      if (targetIds.size > 0) {
        createBulkNotifications({
          userIds: [...targetIds],
          title: `📅 ${data.title || "New Event"}`,
          message: `${data.date ? `Date: ${data.date}` : ""}${data.venue ? ` | Venue: ${data.venue}` : ""}`.trim() || "A new event has been created.",
          type: "info",
          link: "/resident/events",
        }).catch((err) => console.error("[EventContext] Bulk notification error:", err));
      }

      toast.success("Event Created Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to create event");
      return false;
    }
  }

  async function updateEvent(id, data) {
    try {
      await updateEventService(id, data);
      toast.success("Event Updated Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update event");
      return false;
    }
  }

  async function registerForEvent(id, existingRegistrations, registration) {
    try {
      await registerService(id, existingRegistrations, registration);
      toast.success("Registered Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to register");
      return false;
    }
  }

  async function unregisterFromEvent(id, existingRegistrations, residentId) {
    try {
      await unregisterService(id, existingRegistrations, residentId);
      toast.success("Registration Cancelled");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel registration");
      return false;
    }
  }

  async function deleteEvent(id) {
    try {
      await deleteEventService(id);
      toast.success("Event Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete event");
    }
  }

  return (
    <EventContext.Provider
      value={{
        events: filteredEvents,
        allEvents: events,
        addEvent,
        updateEvent,
        deleteEvent,
        registerForEvent,
        unregisterFromEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  return useContext(EventContext);
}
