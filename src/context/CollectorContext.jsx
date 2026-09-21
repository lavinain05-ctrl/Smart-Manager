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
    const userRole = (user?.role || "").toLowerCase();
    const isAdminUser = userRole === "admin" || user?.uid === "92jYvGPlKMexX37WEzs7MaDuc7U2";

    if (!user || !isAdminUser) {
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
      const uid = await createCollectorAccount(data);
      // Immediate optimistic update so newly added collector appears instantly
      if (uid) {
        setCollectors((prev) => {
          if (prev.some((c) => (c.id || c.uid) === uid)) return prev;
          return [
            {
              id: uid,
              uid,
              ...data,
              status: data.status || "Active",
              assignedModules: data.assignedModules || ["garbage"],
            },
            ...prev,
          ];
        });
      }
      toast.success("Collector added with mobile login");
      return true;
    } catch (error) {
      console.error("[CollectorContext] Add error:", error);

      if (
        error.message?.includes("already registered") ||
        error.code === "auth/email-already-in-use"
      ) {
        toast.error(error.message || "This mobile number is already registered");
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
      setCollectors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      toast.success("Collector Updated Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update collector");
      return false;
    }
  }

  async function deleteCollector(id) {
    try {
      await deleteCollectorFromFirestore(id);
      setCollectors((prev) => prev.filter((c) => c.id !== id && c.uid !== id));
      toast.success("Collector Deleted Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete collector");
      return false;
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