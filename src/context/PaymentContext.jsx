import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";

import toast from "react-hot-toast";

import {
  subscribePayments,
  subscribeResidentPayments,
  addPaymentToFirestore,
  checkPaymentExists,
  deletePaymentFromFirestore,
  findMatchingBill,
  addPaymentAudit,
} from "../services/paymentService";

import { updateBill } from "../services/billService";
import { doc, getDoc, getDocs, query, where, collection, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

import { useBilling } from "./BillingContext";
import { useAuth } from "./AuthContext";
import { logActivity } from "../services/activityLogService";

const PaymentContext = createContext();

export function PaymentProvider({ children }) {
  const [payments, setPayments] = useState([]);
  const { selectedYear } = useBilling();
  const { user } = useAuth();
  const hasSyncedRef = useRef(false);

  const residentId = useMemo(() => {
    if (!user) return null;
    return user.residentId || user.parentResidentId || user.uid;
  }, [user]);

  // Subscribe to payments:
  // - If resident/family, ONLY subscribe to this resident's payments (1000x read reduction)
  // - If admin/collector/committee, subscribe to the selected billing year
  useEffect(() => {
    if (!user) {
      setPayments([]);
      return;
    }

    const isResidentRole = user.role === "resident" || user.role === "family";

    let unsubscribe;
    if (isResidentRole && residentId) {
      unsubscribe = subscribeResidentPayments(residentId, (data) => {
        setPayments(data);
      });
    } else {
      unsubscribe = subscribePayments(selectedYear, (data) => {
        setPayments(data);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedYear, user, residentId]);

  // Keep Firestore bills, garbageBills, resident charges & garbageAccounts strictly synchronized with payments
  // Run ONLY for admin and at most ONCE per admin session to avoid excessive reads/writes
  useEffect(() => {
    if (!user || user.role !== "admin" || payments.length === 0) return;
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    let cancelled = false;

    async function syncPaymentsWithBills() {
      try {
        for (const p of payments) {
          if (cancelled) break;

          const isExempted = p.paymentMethod === "Exempted";
          const newStatus = isExempted ? "Exempted" : "Paid";
          const finalAmount = isExempted ? 0 : Number(p.amount || 0);

          // 1. Sync bills if status is not synced OR amount is 0
          try {
            const bQ = query(
              collection(db, "bills"),
              where("residentId", "==", p.residentId),
              where("month", "==", p.month),
              where("year", "==", Number(p.year))
            );
            const bSnap = await getDocs(bQ);
            if (!bSnap.empty) {
              for (const bDoc of bSnap.docs) {
                const bData = bDoc.data();
                const needsUpdate =
                  bData.status !== newStatus ||
                  (finalAmount > 0 && (!bData.amount || Number(bData.amount) === 0)) ||
                  (finalAmount > 0 && (!bData.paidAmount || Number(bData.paidAmount) === 0));

                if (needsUpdate) {
                  await updateBill(bDoc.id, {
                    status: newStatus,
                    amount: finalAmount > 0 && (!bData.amount || Number(bData.amount) === 0) ? finalAmount : (bData.amount || finalAmount),
                    paidAmount: finalAmount,
                    paymentId: p.receiptNumber || bData.paymentId || "",
                    paymentDate: p.paymentDate || bData.paymentDate || "",
                    paymentMethod: p.paymentMethod || bData.paymentMethod || "Cash",
                  });
                }
              }
            } else if (p.residentId && finalAmount > 0) {
              // Create missing bill record in bills collection
              await addDoc(collection(db, "bills"), {
                residentId: p.residentId,
                residentName: p.residentName || "",
                flat: p.flat || "",
                block: p.block || "",
                amount: finalAmount,
                paidAmount: finalAmount,
                month: p.month,
                year: Number(p.year),
                status: newStatus,
                paymentId: p.receiptNumber || "",
                paymentDate: p.paymentDate || "",
                paymentMethod: p.paymentMethod || "Cash",
                dueDate: `10 ${p.month} ${p.year}`,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            // Ignore single doc err
          }

          // 2. Sync garbageBills
          try {
            const gQ = query(
              collection(db, "garbageBills"),
              where("residentId", "==", p.residentId),
              where("month", "==", p.month),
              where("year", "==", Number(p.year))
            );
            const gSnap = await getDocs(gQ);

            // Also check garbageAccounts
            let gAccId = "";
            try {
              const accQuery = query(collection(db, "garbageAccounts"), where("residentId", "==", p.residentId));
              const accSnap = await getDocs(accQuery);
              if (!accSnap.empty) {
                gAccId = accSnap.docs[0].id;
                const accData = accSnap.docs[0].data();
                if (finalAmount > 0 && (!accData.monthlyCharge || Number(accData.monthlyCharge) === 0)) {
                  await updateDoc(doc(db, "garbageAccounts", gAccId), {
                    monthlyCharge: finalAmount,
                    updatedAt: serverTimestamp(),
                  });
                }
              } else if (finalAmount > 0 && p.residentId) {
                const newAcc = await addDoc(collection(db, "garbageAccounts"), {
                  residentId: p.residentId,
                  monthlyCharge: finalAmount,
                  collectorId: p.collectorId || "",
                  collectorName: p.collector || "",
                  status: "active",
                  joinedDate: p.paymentDate || new Date().toISOString().split("T")[0],
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                gAccId = newAcc.id;
              }
            } catch (aErr) {
              // Ignore
            }

            if (!gSnap.empty) {
              for (const gDoc of gSnap.docs) {
                const gData = gDoc.data();
                const needsUpdate =
                  gData.status !== newStatus ||
                  (finalAmount > 0 && (!gData.amount || Number(gData.amount) === 0)) ||
                  (finalAmount > 0 && (!gData.paidAmount || Number(gData.paidAmount) === 0));

                if (needsUpdate) {
                  await updateDoc(doc(db, "garbageBills", gDoc.id), {
                    status: newStatus,
                    amount: finalAmount > 0 && (!gData.amount || Number(gData.amount) === 0) ? finalAmount : (gData.amount || finalAmount),
                    paidAmount: finalAmount,
                    paymentDate: p.paymentDate || "",
                    paymentMethod: p.paymentMethod || "Cash",
                    collectedById: p.collectorId || "",
                    updatedAt: serverTimestamp(),
                  });
                }
              }
            } else if (p.residentId && finalAmount > 0) {
              // Create garbageBills document
              await addDoc(collection(db, "garbageBills"), {
                accountId: gAccId || "",
                residentId: p.residentId,
                month: p.month,
                year: Number(p.year),
                amount: finalAmount,
                paidAmount: finalAmount,
                status: newStatus,
                paymentDate: p.paymentDate || "",
                paymentMethod: p.paymentMethod || "Cash",
                collectedById: p.collectorId || "",
                dueDate: `10 ${p.month} ${p.year}`,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (err) {
            // Ignore single doc err
          }

          // 3. Sync resident charge if 0 or missing
          if (p.residentId && finalAmount > 0) {
            try {
              const resDocRef = doc(db, "residents", p.residentId);
              const resSnap = await getDoc(resDocRef);
              if (resSnap.exists()) {
                const resData = resSnap.data();
                if (!resData.charge || Number(resData.charge) === 0) {
                  await updateDoc(resDocRef, {
                    charge: finalAmount,
                    updatedAt: serverTimestamp(),
                  });
                }
              }
            } catch (rErr) {
              // Ignore
            }
          }
        }
      } catch (e) {
        console.warn("Background payment sync error:", e);
      }
    }

    syncPaymentsWithBills();
    return () => { cancelled = true; };
  }, [payments, user]);

  // Add Payment
  async function addPayment(payment) {
    try {
      const exists = await checkPaymentExists(
        payment.residentId,
        payment.month,
        payment.year
      );

      if (exists) {
        toast.error(
          "Payment already collected for this month."
        );
        return false;
      }

      await addPaymentToFirestore(payment);

      const isExempted = payment.paymentMethod === "Exempted";
      const newStatus = isExempted ? "Exempted" : "Paid";
      const finalAmount = isExempted ? 0 : Number(payment.amount || 0);

      // 1. Sync matching bill in 'bills' collection
      try {
        const matchingBill = await findMatchingBill(
          payment.residentId,
          payment.month,
          payment.year
        );
        if (matchingBill) {
          await updateBill(matchingBill.id, {
            status: newStatus,
            amount: finalAmount > 0 ? finalAmount : (matchingBill.amount || 0),
            paidAmount: finalAmount,
            paymentId: payment.receiptNumber || "",
            paymentDate: payment.paymentDate || new Date().toLocaleDateString("en-IN"),
            paymentMethod: payment.paymentMethod || "Cash",
          });
        }
      } catch (bErr) {
        console.warn("Could not sync bills on addPayment:", bErr.message);
      }

      // 2. Sync matching bill in 'garbageBills' collection and garbageAccounts
      try {
        let accountId = "";
        try {
          const accQuery = query(collection(db, "garbageAccounts"), where("residentId", "==", payment.residentId));
          const accSnap = await getDocs(accQuery);
          if (!accSnap.empty) {
            accountId = accSnap.docs[0].id;
            const accData = accSnap.docs[0].data();
            if (finalAmount > 0 && (!accData.monthlyCharge || Number(accData.monthlyCharge) === 0)) {
              await updateDoc(doc(db, "garbageAccounts", accountId), {
                monthlyCharge: finalAmount,
                updatedAt: serverTimestamp(),
              });
            }
          } else if (finalAmount > 0) {
            const newAcc = await addDoc(collection(db, "garbageAccounts"), {
              residentId: payment.residentId,
              monthlyCharge: finalAmount,
              collectorId: payment.collectorId || "",
              collectorName: payment.collector || "",
              status: "active",
              joinedDate: payment.paymentDate || new Date().toISOString().split("T")[0],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            accountId = newAcc.id;
          }
        } catch (accErr) {
          console.warn("Could not sync garbageAccount:", accErr.message);
        }

        const gBillQuery = query(
          collection(db, "garbageBills"),
          where("residentId", "==", payment.residentId),
          where("month", "==", payment.month),
          where("year", "==", Number(payment.year))
        );
        const gSnap = await getDocs(gBillQuery);
        if (!gSnap.empty) {
          await Promise.all(
            gSnap.docs.map((gDoc) =>
              updateDoc(doc(db, "garbageBills", gDoc.id), {
                status: newStatus,
                amount: finalAmount > 0 ? finalAmount : (gDoc.data().amount || 0),
                paidAmount: finalAmount,
                paymentDate: payment.paymentDate || new Date().toLocaleDateString("en-IN"),
                paymentMethod: payment.paymentMethod || "Cash",
                collectedById: payment.collectorId || "",
                updatedAt: serverTimestamp(),
              })
            )
          );
        } else {
          await addDoc(collection(db, "garbageBills"), {
            accountId: accountId || "",
            residentId: payment.residentId,
            month: payment.month,
            year: Number(payment.year),
            amount: finalAmount,
            paidAmount: finalAmount,
            status: newStatus,
            paymentDate: payment.paymentDate || new Date().toLocaleDateString("en-IN"),
            paymentMethod: payment.paymentMethod || "Cash",
            collectedById: payment.collectorId || "",
            dueDate: `10 ${payment.month} ${payment.year}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (gErr) {
        console.warn("Could not sync garbageBills on addPayment:", gErr.message);
      }

      // 3. Sync resident charge if 0 or empty
      if (payment.residentId && finalAmount > 0) {
        try {
          const resDocRef = doc(db, "residents", payment.residentId);
          const resSnap = await getDoc(resDocRef);
          if (resSnap.exists()) {
            const resData = resSnap.data();
            if (!resData.charge || Number(resData.charge) === 0) {
              await updateDoc(resDocRef, {
                charge: finalAmount,
                updatedAt: serverTimestamp(),
              });
            }
          }
        } catch (rErr) {
          console.warn("Could not update resident charge:", rErr.message);
        }
      }

      // Log work to activity audit trail
      logActivity({
        action: `Collected Payment ₹${payment.amount} (${payment.paymentMethod || "Cash"})`,
        category: "payment",
        performedBy: user?.uid || payment.collectorId || "",
        performedByName: user?.name || payment.collector || "Staff",
        performedByRole: user?.role || "collector",
        portal: user?.role === "collector" ? "Collector Portal" : "Admin Portal",
        targetId: payment.residentId || "",
        targetName: `${payment.residentName || "Resident"} (Flat: ${payment.flat || "—"})`,
        details: `Month: ${payment.month} ${payment.year} • Receipt: ${payment.receiptNumber || "—"}`,
      }).catch(() => {});

      toast.success(
        "Payment Collected Successfully"
      );

      return true;
    } catch (error) {
      console.error(error);

      toast.error(
        "Failed to collect payment"
      );

      return false;
    }
  }

  // Reverse Payment (Admin only)
  async function reversePayment(payment, adminUser) {
    try {
      // 1. Write audit record FIRST (before deleting)
      await addPaymentAudit({
        paymentId: payment.id,
        residentId: payment.residentId,
        residentName: payment.residentName,
        flatNumber: payment.flat,
        amount: payment.amount,
        month: payment.month,
        year: payment.year,
        deletedBy: adminUser.uid,
        deletedByName: adminUser.name || adminUser.email,
        reason: "Admin Reversed Payment",
      });

      // Log reversal to activity logs
      logActivity({
        action: `Reversed Payment ₹${payment.amount} (${payment.receiptNumber || ""})`,
        category: "payment",
        performedBy: adminUser?.uid || user?.uid || "",
        performedByName: adminUser?.name || user?.name || "Admin",
        performedByRole: "admin",
        portal: "Admin Portal",
        targetId: payment.residentId || "",
        targetName: `${payment.residentName || "Resident"} (Flat: ${payment.flat || "—"})`,
        details: `Reversal Reason: Admin Reversed Payment`,
      }).catch(() => {});

      // 2. Delete the payment document
      await deletePaymentFromFirestore(payment.id);

      // 3. Find matching bill using residentId + month + year
      const matchingBill = await findMatchingBill(
        payment.residentId,
        payment.month,
        payment.year
      );

      if (matchingBill) {
        await updateBill(matchingBill.id, {
          status: "Pending",
          paymentDate: "",
          paymentMethod: null,
          paymentId: "",
          paymentTime: null,
          collectorId: null,
          collectorName: null,
          receiptNumber: null,
          transactionId: null,
        });
      }

      // Also reset matching garbageBills if exists
      try {
        const gBillQuery = query(
          collection(db, "garbageBills"),
          where("residentId", "==", payment.residentId),
          where("month", "==", payment.month),
          where("year", "==", Number(payment.year))
        );
        const gSnap = await getDocs(gBillQuery);
        if (!gSnap.empty) {
          await Promise.all(
            gSnap.docs.map((gDoc) =>
              updateDoc(doc(db, "garbageBills", gDoc.id), {
                status: "Pending",
                paidAmount: 0,
                paymentDate: "",
                paymentMethod: "",
                collectedById: "",
                updatedAt: serverTimestamp(),
              })
            )
          );
        }
      } catch (gErr) {
        console.warn("Could not sync garbageBills reversal:", gErr.message);
      }

      toast.success("Payment reversed successfully.");
      return true;
    } catch (error) {
      console.error("Reverse payment error:", error);
      toast.error("Failed to reverse payment");
      return false;
    }
  }

  return (
    <PaymentContext.Provider
      value={{
        payments,
        addPayment,
        reversePayment,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayments() {
  return useContext(PaymentContext);
}