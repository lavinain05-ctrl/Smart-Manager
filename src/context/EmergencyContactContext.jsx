import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeEmergencyContacts,
  addEmergencyContact as addService,
  updateEmergencyContact as updateService,
  deleteEmergencyContact as deleteService,
} from "../services/emergencyContactService";

import { useAuth } from "./AuthContext";

const EmergencyContactContext = createContext();

export function EmergencyContactProvider({ children }) {
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setEmergencyContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const safetyTimer = setTimeout(() => setLoading(false), 2000);
    const unsubscribe = subscribeEmergencyContacts((data) => {
      clearTimeout(safetyTimer);
      setEmergencyContacts(data || []);
      setLoading(false);
    });
    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user?.uid]);

  async function addContact(data) {
    try {
      await addService(data);
      toast.success("Emergency Contact Added");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to add contact");
      return false;
    }
  }

  async function updateContact(id, data) {
    try {
      await updateService(id, data);
      toast.success("Contact Updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update contact");
      return false;
    }
  }

  async function deleteContact(id) {
    try {
      await deleteService(id);
      toast.success("Contact Deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete contact");
    }
  }

  return (
    <EmergencyContactContext.Provider
      value={{
        emergencyContacts,
        loading,
        addContact,
        updateContact,
        deleteContact,
      }}
    >
      {children}
    </EmergencyContactContext.Provider>
  );
}

export function useEmergencyContacts() {
  const ctx = useContext(EmergencyContactContext);
  return ctx || {
    emergencyContacts: [],
    loading: false,
    addContact: async () => false,
    updateContact: async () => false,
    deleteContact: async () => {},
  };
}
