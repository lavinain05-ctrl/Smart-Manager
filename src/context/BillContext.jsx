import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import toast from "react-hot-toast";
import { getDocs, query, where, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

import {
  subscribeBills,
  subscribeResidentBills,
  addBill,
} from "../services/billService";
import { createNotification } from "../services/notificationService";

import { useResidents } from "./ResidentContext";
import { useBilling } from "./BillingContext";
import { useAuth } from "./AuthContext";
import { isGcParticipating } from "../services/statisticsService";

const BillContext = createContext();

export function BillProvider({ children }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  const { residents = [] } = useResidents();
  const { user } = useAuth();

  const {
    selectedMonth,
    selectedYear,
  } = useBilling();

  const residentId = useMemo(() => {
    if (!user) return null;
    return user.residentId || user.parentResidentId || user.uid;
  }, [user]);

  // Subscribe to bills:
  // - If resident/family, ONLY fetch their own bills (1000x read reduction)
  // - If admin/collector/committee, fetch bills for the selected year
  useEffect(() => {
    if (!user) {
      setBills([]);
      return;
    }

    const isResidentRole = user.role === "resident" || user.role === "family";

    let unsubscribe;
    if (isResidentRole && residentId) {
      unsubscribe = subscribeResidentBills(residentId, selectedYear, (data) => {
        setBills(data);
      });
    } else {
      unsubscribe = subscribeBills(selectedYear, (data) => {
        setBills(data);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedYear, user, residentId]);

  async function generateBills() {
    if (residents.length === 0) {
      toast.error("No residents found");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Preparing bills for generation...");

    try {
      const existingResidentIds = new Set(
        bills
          .filter(
            (bill) =>
              bill.month === selectedMonth &&
              Number(bill.year) === Number(selectedYear)
          )
          .map((bill) => bill.residentId)
      );

      const residentsToBill = residents.filter(
        (resident) =>
          !existingResidentIds.has(resident.id) &&
          isGcParticipating(resident)
      );

      const BATCH_SIZE = 25;
      let generatedCount = 0;

      for (let i = 0; i < residentsToBill.length; i += BATCH_SIZE) {
        const chunk = residentsToBill.slice(i, i + BATCH_SIZE);
        toast.loading(`Generating bills... (${Math.min(i + chunk.length, residentsToBill.length)} / ${residentsToBill.length})`, {
          id: toastId,
        });

        await Promise.all(
          chunk.map(async (resident) => {
            await addBill({
              residentId: resident.id,
              residentName: resident.owner,
              flat: resident.flat,
              block: resident.block,
              amount: Number(resident.charge),
              month: selectedMonth,
              year: selectedYear,
              status: "Pending",
              paymentId: "",
              paymentDate: "",
              dueDate: `10 ${selectedMonth} ${selectedYear}`,
            });

            // Also ensure matching garbageBills doc exists
            try {
              const gQ = query(
                collection(db, "garbageBills"),
                where("residentId", "==", resident.id),
                where("month", "==", selectedMonth),
                where("year", "==", Number(selectedYear))
              );
              const gSnap = await getDocs(gQ);
              if (gSnap.empty) {
                let accountId = "";
                try {
                  const aQ = query(
                    collection(db, "garbageAccounts"),
                    where("residentId", "==", resident.id)
                  );
                  const aSnap = await getDocs(aQ);
                  if (!aSnap.empty) {
                    accountId = aSnap.docs[0].id;
                  }
                } catch (aErr) {
                  // Ignore
                }

                await addDoc(collection(db, "garbageBills"), {
                  accountId,
                  residentId: resident.id,
                  month: selectedMonth,
                  year: Number(selectedYear),
                  amount: Number(resident.charge || 0),
                  paidAmount: 0,
                  status: "Pending",
                  paymentDate: "",
                  paymentMethod: "",
                  collectedById: "",
                  dueDate: `10 ${selectedMonth} ${selectedYear}`,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (gErr) {
              console.warn("Could not sync garbageBills generation:", gErr.message);
            }

            // In-App Notification for new month bill
            try {
              const targetIds = [resident.userId, resident.uid, resident.id].filter(Boolean);
              const fee = Number(resident.charge || 80);
              for (const tId of targetIds) {
                await createNotification({
                  userId: tId,
                  title: `🔔 Garbage Fee Due: ${selectedMonth} ${selectedYear}`,
                  message: `Your garbage collection fee of ₹${fee} for ${selectedMonth} ${selectedYear} is due. Due date: 10 ${selectedMonth} ${selectedYear}.`,
                  type: "payment",
                  link: "/resident/bills",
                });
              }
            } catch (nErr) {
              console.warn("Could not send bill notification:", nErr);
            }
          })
        );

        generatedCount += chunk.length;
      }

      toast.success(
        `${generatedCount} bills generated successfully! (${
          residents.length - residentsToBill.length
        } skipped)`,
        { id: toastId }
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate bills", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <BillContext.Provider
      value={{
        bills,
        loading,
        generateBills,
      }}
    >
      {children}
    </BillContext.Provider>
  );
}

export function useBills() {
  return useContext(BillContext);
}