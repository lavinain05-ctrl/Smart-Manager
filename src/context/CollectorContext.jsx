import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeCollectors,
  createCollectorAccount,
  updateCollectorInFirestore,
  deleteCollectorFromFirestore,
} from "../services/collectorService";

import { useAuth } from "./AuthContext";

const CollectorContext = createContext();

export function CollectorProvider({ children }) {
  const [collectors, setCollectors] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    // Only subscribe when the logged-in user is an admin.
    // The Firestore rules only allow admins to read the
    // collectors collection — subscribing as a collector
    // would trigger a permission-denied error.
    if (!user || user.role !== "admin") {
      setCollectors([]);
      return;
    }

    const unsubscribe = subscribeCollectors((data) => {
      setCollectors(data);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.role]);

  async function addCollector(data) {
    try {
      await createCollectorAccount(data);
      toast.success("Collector added with mobile login");
      return true;
    } catch (error) {
      console.error(error);

      if (
        error.message?.includes("already registered") ||
        error.code === "auth/email-already-in-use"
      ) {
        toast.error("This mobile number is already registered");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password must be at least 6 characters");
      } else {
        toast.error(error.message || "Failed to add collector");
      }

      return false;
    }
  }

  async function updateCollector(id, data) {
    try {
      await updateCollectorInFirestore(id, data);
      toast.success("Collector Updated Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update collector");
    }
  }

  async function deleteCollector(id) {
    try {
      await deleteCollectorFromFirestore(id);
      toast.success("Collector Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete collector");
    }
  }

  return (
    <CollectorContext.Provider
      value={{
        collectors,
        addCollector,
        updateCollector,
        deleteCollector,
      }}
    >
      {children}
    </CollectorContext.Provider>
  );
}

export function useCollectors() {
  return useContext(CollectorContext);
}