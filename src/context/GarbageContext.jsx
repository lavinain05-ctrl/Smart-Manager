import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

import {
  getDocs,
  query,
  where,
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import toast from "react-hot-toast";

import { db } from "../firebase/firebase";

import {
  subscribeGarbageAccounts,
  subscribeResidentGarbageAccounts,
  addGarbageAccount as addAccountSvc,
  updateGarbageAccount as updateAccountSvc,
  deleteGarbageAccount as deleteAccountSvc,
  subscribeGarbageBills,
  subscribeResidentGarbageBills,
  addGarbageBill as addBillSvc,
  updateGarbageBill as updateBillSvc,
  deleteGarbageBill as deleteBillSvc,
  generateMonthlyGarbageBills,
  subscribeGarbageCollections,
  addGarbageCollection as addCollectionSvc,
  subscribeGarbageCollectors,
  addGarbageCollector as addCollectorSvc,
  updateGarbageCollector as updateCollectorSvc,
  deleteGarbageCollector as deleteCollectorSvc,
  subscribeGarbageRoutes,
  addGarbageRoute as addRouteSvc,
  updateGarbageRoute as updateRouteSvc,
  deleteGarbageRoute as deleteRouteSvc,
  subscribeGarbageSettings,
  saveGarbageSettings as saveSettingsSvc,
  subscribeGarbageRequests,
  addGarbageRequest as addRequestSvc,
  updateGarbageRequest as updateRequestSvc,
  deleteGarbageRequest as deleteRequestSvc,
  logGarbageActivity,
  subscribeGarbageLogs,
  getGarbageAccountByResidentId,
  relinkGarbageAccount as relinkAccountSvc,
} from "../services/garbageService";

import { linkResidentToFlat } from "../services/blockFlatService";

import {
  updateGarbageStatus,
} from "../services/residentService";

import { isGcParticipating } from "../services/statisticsService";

import {
  createNotification,
  createBulkNotifications,
} from "../services/notificationService";

import { useAuth } from "./AuthContext";
import { useResidents } from "./ResidentContext";
import { useCollectors } from "./CollectorContext";
import { usePayments } from "./PaymentContext";
import { checkPaymentExists, findMatchingBill } from "../services/paymentService";
import { updateBill } from "../services/billService";

const GarbageContext = createContext();

export function GarbageProvider({ children }) {
  const { user } = useAuth();
  const { residents } = useResidents();
  const { collectors } = useCollectors();
  const { payments = [], addPayment } = usePayments();

  // =============================================
  // State (raw Firestore data — IDs only)
  // =============================================

  const [garbageAccounts, setGarbageAccounts] = useState([]);
  const [garbageBills, setGarbageBills] = useState([]);
  const [garbageCollections, setGarbageCollections] = useState([]);
  const [garbageCollectors, setGarbageCollectors] = useState([]);
  const [garbageRoutes, setGarbageRoutes] = useState([]);
  const [garbageSettings, setGarbageSettings] = useState({
    defaultCharge: 0,
    billDueDay: 10,
    collectionTime: "",
    enableNotifications: true,
  });
  const [garbageRequests, setGarbageRequests] = useState([]);
  const [garbageLogs, setGarbageLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Billing period selector
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    now.toLocaleString("default", { month: "long" })
  );
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // =============================================
  // Lookup helpers (master data → fast maps)
  // =============================================

  const residentsMap = useMemo(() => {
    const map = {};
    (residents || []).forEach((r) => { map[r.id] = r; });
    return map;
  }, [residents]);

  const collectorsMap = useMemo(() => {
    const map = {};
    (collectors || []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [collectors]);

  function getResident(id) {
    return residentsMap[id] || null;
  }

  function getCollector(id) {
    return collectorsMap[id] || null;
  }

  // =============================================
  // RESOLVED JOINS — single source of truth
  // =============================================

  const resolvedAccounts = useMemo(() => {
    return garbageAccounts.map((acc) => {
      const resident = getResident(acc.residentId);
      const collector = getCollector(acc.collectorId);
      const isUnlinked = !resident;
      return {
        ...acc,
        // Resolved from master data (single source of truth)
        residentName: resident?.owner || "Unlinked Account",
        flat: resident?.flat || acc.flat || "",
        block: resident?.block || acc.block || "",
        mobile: resident?.mobile || acc.mobile || "",
        email: resident?.email || acc.email || "",
        collectorName: collector?.name || "",
        _isUnlinked: isUnlinked,
        _orphan: isUnlinked,
        _residentExists: !isUnlinked,
      };
    });
  }, [garbageAccounts, residentsMap, collectorsMap]);

  const resolvedBills = useMemo(() => {
    return garbageBills.map((bill) => {
      const resident = getResident(bill.residentId);
      const collector = getCollector(bill.collectedById);

      // Cross-reference with real-time payments collection
      const paymentMatch = (payments || []).find(
        (p) =>
          (p.residentId === bill.residentId || (resident?.id && p.residentId === resident.id)) &&
          p.month === bill.month &&
          Number(p.year) === Number(bill.year)
      );

      const effectiveStatus = paymentMatch
        ? (paymentMatch.paymentMethod === "Exempted" ? "Exempted" : "Paid")
        : (bill.status || "Pending");

      const effectivePaidAmount = paymentMatch
        ? (paymentMatch.paymentMethod === "Exempted" ? 0 : Number(paymentMatch.amount !== undefined ? paymentMatch.amount : bill.amount || 0))
        : Number(bill.paidAmount || 0);

      const effectivePaymentDate = paymentMatch?.paymentDate || bill.paymentDate || "";
      const effectivePaymentMethod = paymentMatch?.paymentMethod || bill.paymentMethod || "";
      const effectiveCollectedBy = paymentMatch?.collector || collector?.name || bill.collectedBy || "";

      return {
        ...bill,
        // Resolved from master data
        residentName: resident?.owner || bill.originalResidentName || "Unlinked Account",
        flat: resident?.flat || bill.flat || "",
        block: resident?.block || bill.block || "",
        status: effectiveStatus,
        paidAmount: effectivePaidAmount,
        paymentDate: effectivePaymentDate,
        paymentMethod: effectivePaymentMethod,
        collectedBy: effectiveCollectedBy,
        _isUnlinked: !resident,
      };
    });
  }, [garbageBills, residentsMap, collectorsMap, payments]);

  const resolvedRequests = useMemo(() => {
    return garbageRequests.map((req) => {
      const resident = getResident(req.residentId);
      return {
        ...req,
        residentName: resident?.owner || req.residentName || "Unlinked Account",
        flat: resident?.flat || req.flat || "",
        block: resident?.block || req.block || "",
      };
    });
  }, [garbageRequests, residentsMap]);

  const resolvedCollectors = useMemo(() => {
    return garbageCollectors.map((gc) => {
      const collector = getCollector(gc.collectorId);
      return {
        ...gc,
        collectorName: collector?.name || "Unassigned",
        collectorEmail: collector?.email || "",
      };
    });
  }, [garbageCollectors, collectorsMap]);

  // =============================================
  // Subscriptions
  // =============================================

  useEffect(() => {
    if (!user) {
      setGarbageAccounts([]);
      setGarbageCollections([]);
      setGarbageCollectors([]);
      setGarbageRoutes([]);
      setGarbageRequests([]);
      setGarbageLogs([]);
      return;
    }

    const isResidentRole = user.role === "resident" || user.role === "family";
    const residentId = user.residentId || user.parentResidentId || user.uid;

    const unsubs = [];
    if (isResidentRole && residentId) {
      unsubs.push(subscribeResidentGarbageAccounts(residentId, setGarbageAccounts));
      unsubs.push(subscribeGarbageSettings(setGarbageSettings));
    } else {
      unsubs.push(subscribeGarbageAccounts(setGarbageAccounts));
      unsubs.push(subscribeGarbageCollections(setGarbageCollections));
      unsubs.push(subscribeGarbageSettings(setGarbageSettings));
      unsubs.push(subscribeGarbageRequests(setGarbageRequests));
    }

    // Admin-only subscriptions
    if (user.role === "admin") {
      unsubs.push(subscribeGarbageCollectors(setGarbageCollectors));
      unsubs.push(subscribeGarbageRoutes(setGarbageRoutes));
      unsubs.push(subscribeGarbageLogs(setGarbageLogs, 200));
    }

    return () => unsubs.forEach((fn) => fn());
  }, [user?.uid, user?.role, user?.residentId, user?.parentResidentId]);

  // Bills subscription scoped by year (and scoped by residentId if resident)
  useEffect(() => {
    if (!user) {
      setGarbageBills([]);
      return;
    }

    const isResidentRole = user.role === "resident" || user.role === "family";
    const residentId = user.residentId || user.parentResidentId || user.uid;

    let unsub;
    if (isResidentRole && residentId) {
      unsub = subscribeResidentGarbageBills(residentId, selectedYear, setGarbageBills);
    } else {
      unsub = subscribeGarbageBills(selectedYear, setGarbageBills);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, user?.role, user?.residentId, user?.parentResidentId, selectedYear]);

  // Automatic two-way synchronization between garbageAccounts and residents
  // Guard with ref to run at most once per admin session
  const hasHarmonizedRef = useRef(false);
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (hasHarmonizedRef.current) return;
    if (!garbageAccounts.length || !residents.length) return;
    hasHarmonizedRef.current = true;

    let cancelled = false;
    async function harmonizeStatuses() {
      for (const acc of garbageAccounts) {
        if (cancelled) break;
        const resident = residents.find((r) => r.id === acc.residentId);
        if (!resident) continue;

        const shouldBeActive =
          isGcParticipating(resident) &&
          resident.status !== "Inactive" &&
          resident.status !== "inactive";

        if (acc.status === "active" && !shouldBeActive) {
          try {
            console.log(`[AutoSync] Harmonizing account for resident ${resident.owner || resident.id} (${resident.flat || "—"}) -> inactive`);
            await updateDoc(doc(db, "garbageAccounts", acc.id), {
              status: "inactive",
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.warn("[AutoSync] Error:", e.message);
          }
        } else if (acc.status === "inactive" && shouldBeActive) {
          try {
            console.log(`[AutoSync] Harmonizing account for resident ${resident.owner || resident.id} (${resident.flat || "—"}) -> active`);
            await updateDoc(doc(db, "garbageAccounts", acc.id), {
              status: "active",
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.warn("[AutoSync] Error:", e.message);
          }
        }
      }
    }

    harmonizeStatuses();
    return () => { cancelled = true; };
  }, [user?.role, garbageAccounts, residents]);

  // =============================================
  // Helper — log
  // =============================================

  const log = useCallback(
    (action, details, targetId, targetName) => {
      logGarbageActivity({
        action,
        category: "garbage",
        performedBy: user?.uid || "",
        performedByName: user?.name || user?.email || "",
        details,
        targetId: targetId || "",
        targetName: targetName || "",
      }).catch(console.error);
    },
    [user]
  );

  // =============================================
  // ACCOUNT CRUD — stores IDs only, syncs garbageStatus
  // =============================================

  async function addAccount(data) {
    try {
      // Validate: must reference an existing resident
      if (!data.residentId) {
        toast.error("Please select a resident.");
        return false;
      }
      const resident = getResident(data.residentId);
      if (!resident) {
        toast.error("Cannot create account: selected resident not found.");
        return false;
      }

      // Default charge from garbage settings if not specified
      const charge = Number(
        data.monthlyCharge || garbageSettings.defaultCharge || 0
      );

      const ref = await addAccountSvc({
        residentId: data.residentId,
        monthlyCharge: charge,
        collectorId: data.collectorId || "",
        status: "active",
      });

      // Sync master resident garbageStatus
      await updateGarbageStatus(data.residentId, "participating");

      log("Account Created", `Garbage account created for ${resident.owner} (${resident.flat})`, ref.id, resident.owner);

      if (garbageSettings.enableNotifications && data.residentId) {
        createNotification({
          userId: data.residentId,
          title: "Garbage Collection Enrolled",
          message: `You have been enrolled in garbage collection. Monthly charge: ₹${data.monthlyCharge || garbageSettings.defaultCharge}`,
          type: "info",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Garbage account created");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to create garbage account");
      return false;
    }
  }

  async function updateAccount(id, data) {
    try {
      await updateAccountSvc(id, {
        monthlyCharge: Number(data.monthlyCharge || 0),
        collectorId: data.collectorId || "",
        status: data.status,
        remarks: data.remarks || "",
      });

      const acc = garbageAccounts.find((a) => a.id === id);
      // Two-way sync: Update master resident garbageStatus
      if (acc?.residentId && data.status) {
        await updateGarbageStatus(
          acc.residentId,
          data.status === "active" ? "participating" : "not_participating"
        );
      }

      const res = getResident(acc?.residentId);
      log("Account Updated", `Garbage account updated: ${res?.owner || id}`, id, res?.owner || "");
      toast.success("Garbage account updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update garbage account");
      return false;
    }
  }

  async function relinkAccount(accountId, newResidentId) {
    try {
      const targetResident = getResident(newResidentId);
      if (!targetResident) {
        toast.error("Selected resident does not exist.");
        return false;
      }
      await relinkAccountSvc(accountId, newResidentId);
      // Synchronize participation status
      if (isGcParticipating(targetResident)) {
        await updateAccountSvc(accountId, { status: "active" });
      } else {
        await updateAccountSvc(accountId, { status: "inactive" });
      }
      log("Account Relinked", `Garbage account relinked to ${targetResident.owner}`, accountId, targetResident.owner);
      toast.success(`Account linked to ${targetResident.owner}`);
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to link account");
      return false;
    }
  }

  async function deleteAccount(id) {
    try {
      const acc = garbageAccounts.find((a) => a.id === id);
      const resident = getResident(acc?.residentId);
      await deleteAccountSvc(id);

      // Sync master resident garbageStatus
      if (acc?.residentId) {
        await updateGarbageStatus(acc.residentId, "not_participating");
      }

      log("Account Deleted", `Garbage account deleted: ${resident?.owner || id}`, id, resident?.owner || "");

      if (garbageSettings.enableNotifications && acc?.residentId) {
        createNotification({
          userId: acc.residentId,
          title: "Garbage Account Disabled",
          message: "Your garbage collection account has been removed.",
          type: "warning",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Garbage account deleted");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete garbage account");
      return false;
    }
  }

  async function toggleAccountStatus(id, newStatus) {
    try {
      await updateAccountSvc(id, { status: newStatus });
      const acc = garbageAccounts.find((a) => a.id === id);
      const resident = getResident(acc?.residentId);

      // Sync master resident garbageStatus
      if (acc?.residentId) {
        await updateGarbageStatus(
          acc.residentId,
          newStatus === "active" ? "participating" : "not_participating"
        );
      }

      log("Status Changed", `Account ${newStatus}: ${resident?.owner || id}`, id, resident?.owner || "");

      if (garbageSettings.enableNotifications && acc?.residentId) {
        createNotification({
          userId: acc.residentId,
          title: `Garbage Collection ${newStatus === "active" ? "Activated" : "Deactivated"}`,
          message: `Your garbage collection has been ${newStatus === "active" ? "activated" : "deactivated"}.`,
          type: newStatus === "active" ? "info" : "warning",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success(`Account ${newStatus}`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
      return false;
    }
  }

  // =============================================
  // BILL OPERATIONS — IDs only
  // =============================================

  async function generateBills() {
    if (garbageAccounts.length === 0) {
      toast.error("No garbage accounts found");
      return;
    }

    setLoading(true);
    try {
      const result = await generateMonthlyGarbageBills(
        garbageAccounts,
        selectedMonth,
        selectedYear,
        garbageBills,
        residents
      );

      log("Bills Generated", `${result.generated} bills for ${selectedMonth} ${selectedYear} (${result.skipped} skipped)`);

      // Notify all billed residents
      if (result.generated > 0) {
        const activeAccounts = garbageAccounts.filter((a) => a.status === "active" && a.residentId);
        const userIds = [];
        activeAccounts.forEach((a) => {
          if (a.residentId) userIds.push(a.residentId);
          const matchedResident = residents.find((r) => r.id === a.residentId);
          if (matchedResident?.userId) userIds.push(matchedResident.userId);
          if (matchedResident?.uid) userIds.push(matchedResident.uid);
        });

        const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (uniqueUserIds.length > 0) {
          createBulkNotifications({
            userIds: uniqueUserIds,
            title: `🔔 Garbage Fee Due: ${selectedMonth} ${selectedYear}`,
            message: `Your garbage collection bill for ${selectedMonth} ${selectedYear} has been generated. Due date: 10 ${selectedMonth} ${selectedYear}.`,
            type: "payment",
            link: "/resident/bills",
          }).catch((err) => console.warn("Could not dispatch bulk bill notifications:", err));
        }
      }

      toast.success(`${result.generated} bills generated (${result.skipped} skipped)`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate bills");
    } finally {
      setLoading(false);
    }
  }

  async function recordPayment(billId, paymentData) {
    try {
      let bill = garbageBills.find((b) => b.id === billId);
      const isVirtual = billId?.startsWith?.("auto-") || !bill;
      const residentId = bill?.residentId || (billId?.startsWith?.("auto-") ? billId.replace("auto-", "") : "");
      const resident = getResident(residentId);
      const amount = Number(paymentData.amount !== undefined ? paymentData.amount : (bill?.amount || resident?.charge || 80));
      const receiptNo = "REC-" + Date.now();
      const isExempted = paymentData.paymentMethod === "Exempted";
      const newStatus = isExempted ? "Exempted" : "Paid";
      const finalAmount = isExempted ? 0 : amount;
      let effectiveBillId = billId;

      if (isVirtual) {
        // Create the actual garbage bill first in Firestore
        effectiveBillId = await addBillSvc({
          accountId: bill?.accountId || "",
          residentId,
          month: bill?.month || selectedMonth,
          year: Number(bill?.year || selectedYear),
          amount,
          status: newStatus,
          paidAmount: finalAmount,
          paymentDate: paymentData.paymentDate || new Date().toLocaleDateString("en-IN"),
          paymentMethod: paymentData.paymentMethod || "Cash",
          collectedBy: paymentData.collectedBy || user?.name || "Admin",
          dueDate: `10 ${bill?.month || selectedMonth} ${bill?.year || selectedYear}`,
        });
        bill = {
          id: effectiveBillId,
          residentId,
          month: bill?.month || selectedMonth,
          year: Number(bill?.year || selectedYear),
          amount,
          status: newStatus,
          paidAmount: finalAmount,
        };
      } else {
        await updateBillSvc(billId, {
          status: newStatus,
          paidAmount: finalAmount,
          paymentDate: paymentData.paymentDate || new Date().toLocaleDateString("en-IN"),
          paymentMethod: paymentData.paymentMethod || "Cash",
          collectedById: paymentData.collectedById || user?.uid || "",
        });
      }

      // Synchronize to payments collection if not already recorded
      if (bill?.residentId && bill?.month && bill?.year) {
        const alreadyPaid = await checkPaymentExists(bill.residentId, bill.month, bill.year);
        if (!alreadyPaid) {
          await addPayment({
            residentId: bill.residentId,
            residentName: resident?.owner || bill.residentName || "",
            flat: resident?.flat || bill.flat || "",
            block: resident?.block || bill.block || "",
            amount: finalAmount,
            paymentMethod: paymentData.paymentMethod || "Cash",
            paymentDate: paymentData.paymentDate || new Date().toLocaleDateString("en-IN"),
            paymentTime: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            collector: user?.name || "Admin",
            collectorId: user?.uid || null,
            remarks: "Garbage collection bill payment",
            receiptNumber: receiptNo,
            month: bill.month,
            year: Number(bill.year),
            billId: bill.id,
          });
        }

        // Synchronize matching bill in 'bills' collection
        const matchingBill = await findMatchingBill(bill.residentId, bill.month, bill.year);
        if (matchingBill) {
          await updateBill(matchingBill.id, {
            status: newStatus,
            paymentId: receiptNo,
            paymentDate: paymentData.paymentDate || new Date().toLocaleDateString("en-IN"),
            paymentMethod: paymentData.paymentMethod || "Cash",
          });
        }
      }

      log("Payment Recorded", `₹${finalAmount} from ${resident?.owner || ""} (${resident?.flat || ""}) for ${bill?.month || ""} ${bill?.year || ""}`, billId, resident?.owner || "");

      if (garbageSettings.enableNotifications && bill?.residentId) {
        createNotification({
          userId: bill.residentId,
          title: "Garbage Payment Recorded",
          message: `₹${finalAmount} received for ${bill?.month} ${bill?.year}. Method: ${paymentData.paymentMethod || "Cash"}.`,
          type: "success",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Payment recorded");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to record payment");
      return false;
    }
  }

  async function deleteBill(id) {
    try {
      await deleteBillSvc(id);
      log("Bill Deleted", `Garbage bill deleted: ${id}`, id);
      toast.success("Bill deleted");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill");
      return false;
    }
  }

  // =============================================
  // COLLECTOR ASSIGNMENT — IDs only
  // =============================================

  async function addGarbageCollectorAssignment(data) {
    try {
      const collector = getCollector(data.collectorId);
      await addCollectorSvc(data);
      log("Collector Assigned", `${collector?.name || "Collector"} assigned to garbage collection`, "", collector?.name || "");
      toast.success("Collector assigned");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign collector");
      return false;
    }
  }

  async function updateGarbageCollectorAssignment(id, data) {
    try {
      await updateCollectorSvc(id, data);
      log("Collector Updated", `Garbage collector assignment updated`, id);
      toast.success("Collector assignment updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update assignment");
      return false;
    }
  }

  async function deleteGarbageCollectorAssignment(id) {
    try {
      await deleteCollectorSvc(id);
      log("Collector Removed", `Garbage collector assignment removed`, id);
      toast.success("Collector assignment removed");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove assignment");
      return false;
    }
  }

  // =============================================
  // ROUTE MANAGEMENT
  // =============================================

  async function addRoute(data) {
    try {
      await addRouteSvc(data);
      log("Route Created", `Route "${data.name}" created`, "", data.name);
      toast.success("Route created");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to create route");
      return false;
    }
  }

  async function updateRoute(id, data) {
    try {
      await updateRouteSvc(id, data);
      log("Route Updated", `Route "${data.name}" updated`, id, data.name);
      toast.success("Route updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update route");
      return false;
    }
  }

  async function deleteRoute(id) {
    try {
      await deleteRouteSvc(id);
      log("Route Deleted", `Route deleted`, id);
      toast.success("Route deleted");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete route");
      return false;
    }
  }

  // =============================================
  // SETTINGS
  // =============================================

  async function updateGarbageSettings(data) {
    try {
      await saveSettingsSvc(data);
      log("Settings Updated", "Garbage settings updated");
      toast.success("Garbage settings saved");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings");
      return false;
    }
  }

  // =============================================
  // REQUESTS (opt-in / opt-out) — sync garbageStatus
  // =============================================

  async function submitRequest(data) {
    try {
      await addRequestSvc({
        residentId: data.residentId || "",
        requestType: data.requestType || "opt_in",
        reason: data.reason || "",
      });
      const resident = getResident(data.residentId);
      log("Request Submitted", `${data.requestType} request from ${resident?.owner || ""}`, "", resident?.owner || "");
      toast.success("Request submitted");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit request");
      return false;
    }
  }

  async function approveRequest(id) {
    try {
      const req = garbageRequests.find((r) => r.id === id);
      const resident = getResident(req?.residentId);
      await updateRequestSvc(id, {
        status: "approved",
        processedBy: user?.name || user?.email || "",
      });

      // If opt-in, create account + set garbageStatus. If opt-out, deactivate + set status.
      if (req?.requestType === "opt_in" && req.residentId) {
        await addAccountSvc({
          residentId: req.residentId,
          monthlyCharge: garbageSettings.defaultCharge || 0,
          collectorId: "",
          status: "active",
        });
        await updateGarbageStatus(req.residentId, "participating");
      } else if (req?.requestType === "opt_out" && req.residentId) {
        const acc = garbageAccounts.find((a) => a.residentId === req.residentId);
        if (acc) {
          await updateAccountSvc(acc.id, { status: "inactive" });
        }
        await updateGarbageStatus(req.residentId, "not_participating");
      }

      log("Request Approved", `${req?.requestType} request approved for ${resident?.owner || ""}`, id, resident?.owner || "");

      if (garbageSettings.enableNotifications && req?.residentId) {
        createNotification({
          userId: req.residentId,
          title: "Garbage Request Approved",
          message: `Your ${req.requestType === "opt_in" ? "enrollment" : "opt-out"} request has been approved.`,
          type: "success",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Request approved");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve request");
      return false;
    }
  }

  async function rejectRequest(id) {
    try {
      const req = garbageRequests.find((r) => r.id === id);
      const resident = getResident(req?.residentId);
      await updateRequestSvc(id, {
        status: "rejected",
        processedBy: user?.name || user?.email || "",
      });

      log("Request Rejected", `${req?.requestType} request rejected for ${resident?.owner || ""}`, id, resident?.owner || "");

      if (garbageSettings.enableNotifications && req?.residentId) {
        createNotification({
          userId: req.residentId,
          title: "Garbage Request Rejected",
          message: `Your ${req?.requestType === "opt_in" ? "enrollment" : "opt-out"} request has been rejected.`,
          type: "warning",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Request rejected");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject request");
      return false;
    }
  }

  // =============================================
  // COLLECTION MARKING
  // =============================================

  async function markCollection(data) {
    try {
      await addCollectionSvc(data);
      const resident = getResident(data.residentId);
      log("Collection Marked", `${data.status} — ${resident?.flat || ""} by collector`, "", resident?.flat || "");
      toast.success("Collection marked");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark collection");
      return false;
    }
  }

  // =============================================
  // ASSIGN COLLECTOR TO ACCOUNT — ID only
  // =============================================

  async function assignCollectorToAccount(accountId, collectorId) {
    try {
      await updateAccountSvc(accountId, { collectorId });
      const acc = garbageAccounts.find((a) => a.id === accountId);
      const resident = getResident(acc?.residentId);
      const collector = getCollector(collectorId);

      log("Collector Changed", `Collector "${collector?.name || ""}" assigned to ${resident?.owner || accountId}`, accountId, resident?.owner || "");

      if (garbageSettings.enableNotifications && acc?.residentId) {
        createNotification({
          userId: acc.residentId,
          title: "Garbage Collector Assigned",
          message: `${collector?.name || "A collector"} has been assigned as your garbage collector.`,
          type: "info",
          link: "/resident/garbage",
        }).catch(console.error);
      }

      toast.success("Collector assigned to account");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign collector");
      return false;
    }
  }

  // =============================================
  // Reconciliation — fix legacy data gaps
  // =============================================

  /**
   * Complete two-way reconciliation:
   * 1. Inspects existing garbageAccounts:
   *    - If resident exists: synchronizes status with resident garbageStatus.
   *    - If orphan (resident does not exist): attempts smart relink by flat/block;
   *      if unlinked with NO billing history, safely cleans it up;
   *      if unlinked WITH billing history, preserves it as inactive for audit.
   * 2. Creates missing accounts for participating residents.
   * 3. Links residents to flats.
   */
  async function reconcileGarbageAccounts(options = {}) {
    const isSilent = options?.silent === true;
    let accountsCreated = 0;
    let statusSynced = 0;
    let orphansCleaned = 0;
    let orphansRelinked = 0;
    let flatsLinked = 0;

    const participatingResidents = (residents || []).filter(
      (r) =>
        isGcParticipating(r) &&
        r.status !== "Inactive" && r.status !== "inactive"
    );
    const residentMapById = {};
    (residents || []).forEach((r) => { residentMapById[r.id] = r; });

    // 1. Inspect existing garbageAccounts for status sync & orphan handling
    for (const acc of garbageAccounts) {
      const resident = residentMapById[acc.residentId];

      if (resident) {
        // Master resident data is the single source of truth
        const shouldBeActive =
          isGcParticipating(resident) &&
          resident.status !== "Inactive" &&
          resident.status !== "inactive";

        if (acc.status === "active" && !shouldBeActive) {
          try {
            await updateAccountSvc(acc.id, { status: "inactive" });
            statusSynced++;
          } catch (err) {
            console.warn("Could not sync garbageAccount status:", err.message);
          }
        } else if (acc.status === "inactive" && shouldBeActive) {
          try {
            await updateAccountSvc(acc.id, { status: "active" });
            statusSynced++;
          } catch (err) {
            console.warn("Could not sync garbageAccount status:", err.message);
          }
        }
      } else {
        // Resident does NOT exist in master data (orphan account)
        let matchedResident = null;

        // Try to match by flat and block if stored on account
        if (acc.flat && acc.block) {
          matchedResident = (residents || []).find(
            (r) =>
              r.flat?.trim().toUpperCase() === acc.flat?.trim().toUpperCase() &&
              r.block?.trim().toUpperCase() === acc.block?.trim().toUpperCase()
          );
        }

        if (matchedResident) {
          // Relink to existing resident
          await relinkAccountSvc(acc.id, matchedResident.id);
          const shouldBeActive =
            isGcParticipating(matchedResident) &&
            matchedResident.status !== "Inactive" &&
            matchedResident.status !== "inactive";
          await updateAccountSvc(acc.id, {
            status: shouldBeActive ? "active" : "inactive",
            remarks: `Relinked to ${matchedResident.owner}`,
          });
          orphansRelinked++;
        } else {
          // Check if this account has any associated bills or logs
          const hasBills = garbageBills.some(
            (b) => b.accountId === acc.id || b.residentId === acc.residentId
          );
          const hasCollections = garbageCollections.some(
            (c) => c.accountId === acc.id
          );

          if (!hasBills && !hasCollections) {
            // Phantom account with no financial history: safe to delete
            await deleteAccountSvc(acc.id);
            orphansCleaned++;
          } else {
            // Has historical bills: preserve for audit, ensure inactive
            if (acc.status !== "inactive") {
              await updateAccountSvc(acc.id, {
                status: "inactive",
                remarks: "Unlinked Account — preserved for financial audit",
              });
              statusSynced++;
            }
          }
        }
      }
    }

    // 2. Standardize charges and create missing accounts for participating residents
    let chargesSynced = 0;
    const effectiveStandardFee =
      Number(garbageSettings.defaultCharge) > 0
        ? Number(garbageSettings.defaultCharge)
        : 80;

    // Auto-fix garbageSettings in Firestore if defaultCharge is 0 or empty
    if (!garbageSettings.defaultCharge || Number(garbageSettings.defaultCharge) <= 0) {
      try {
        await saveSettingsSvc({
          defaultCharge: effectiveStandardFee,
          billDueDay: Number(garbageSettings.billDueDay) || 10,
          collectionTime: garbageSettings.collectionTime || "7:00 AM - 9:00 AM",
          enableNotifications: garbageSettings.enableNotifications !== false,
        });
      } catch (e) {
        console.warn("[Reconcile] Could not save default garbageSettings:", e);
      }
    }

    const updatedAccountSnap = await getDocs(collection(db, "garbageAccounts"));
    const currentEnrolledIds = new Set(
      updatedAccountSnap.docs.map((d) => d.data().residentId)
    );

    // Standardize existing accounts if charge is 0
    for (const d of updatedAccountSnap.docs) {
      const a = d.data();
      if (!a.monthlyCharge || Number(a.monthlyCharge) <= 0) {
        try {
          await updateAccountSvc(d.id, { monthlyCharge: effectiveStandardFee });
          chargesSynced++;
        } catch (e) {
          console.warn("[Reconcile] Could not update account charge:", e);
        }
      }
    }

    for (const resident of participatingResidents) {
      // Fix charge if 0 or missing in residents collection
      const existingCharge = Number(resident.charge);
      const effectiveFee = existingCharge > 0 ? existingCharge : effectiveStandardFee;

      if (!existingCharge || existingCharge <= 0) {
        try {
          await updateDoc(doc(db, "residents", resident.id), {
            charge: effectiveFee,
            garbageStatus: "participating",
            updatedAt: serverTimestamp(),
          });
          chargesSynced++;
        } catch (err) {
          console.warn(`[Reconcile] Could not update charge for resident ${resident.id}:`, err);
        }
      }

      // Create missing garbage account if needed
      if (!currentEnrolledIds.has(resident.id)) {
        try {
          await addAccountSvc({
            residentId: resident.id,
            monthlyCharge: effectiveFee,
            collectorId: "",
            status: "active",
          });
          accountsCreated++;
        } catch (err) {
          console.error(`[Reconcile] Failed to create account for ${resident.id}:`, err);
        }
      }
    }

    // 3. Link residents to flats
    for (const resident of participatingResidents) {
      if (resident.blockId && (resident.flat || resident.flatNumber)) {
        try {
          const flatQ = query(
            collection(db, "flats"),
            where("blockId", "==", resident.blockId),
            where("flatNumber", "==", (resident.flat || resident.flatNumber).toUpperCase())
          );
          const snap = await getDocs(flatQ);
          if (!snap.empty) {
            const flatDoc = snap.docs[0];
            const flatData = flatDoc.data();
            if (!flatData.residentId || flatData.residentId === resident.id) {
              await linkResidentToFlat(flatDoc.id, resident.id);
              flatsLinked++;
            }
          }
        } catch (err) {
          console.error(`[Reconcile] Failed to link flat for ${resident.id}:`, err);
        }
      }
    }

    // 4. Synchronize monthly bills in bills and garbageBills collections
    let billsSynced = 0;
    try {
      const bQuery = query(
        collection(db, "bills"),
        where("month", "==", selectedMonth),
        where("year", "==", Number(selectedYear))
      );
      const bSnap = await getDocs(bQuery);
      const existingBillResIds = new Set(bSnap.docs.map((d) => d.data().residentId));

      const gbQuery = query(
        collection(db, "garbageBills"),
        where("month", "==", selectedMonth),
        where("year", "==", Number(selectedYear))
      );
      const gbSnap = await getDocs(gbQuery);
      const existingGbResIds = new Set(gbSnap.docs.map((d) => d.data().residentId));

      const accSnap = await getDocs(collection(db, "garbageAccounts"));
      const accMap = new Map();
      accSnap.docs.forEach((d) => accMap.set(d.data().residentId, d.id));

      // 4A. Update existing bills if charge or payment status is out of sync
      for (const bDoc of bSnap.docs) {
        const bData = bDoc.data();
        const resident = residentMapById[bData.residentId];
        if (resident) {
          const fee = Number(resident.charge) > 0 ? Number(resident.charge) : effectiveStandardFee;
          const paymentMatch = (payments || []).find(
            (p) =>
              (p.residentId === resident.id || p.residentId === resident.uid || (resident.mobile && p.mobile && p.mobile.includes(resident.mobile.slice(-10)))) &&
              p.month === selectedMonth &&
              Number(p.year) === Number(selectedYear)
          );
          const isPaid = Boolean(paymentMatch);

          const needsAmountUpdate = Number(bData.amount) <= 0 && fee > 0;
          const needsPaymentSync = isPaid && bData.status !== "Paid";

          if (needsAmountUpdate || needsPaymentSync) {
            try {
              await updateDoc(doc(db, "bills", bDoc.id), {
                amount: needsAmountUpdate ? fee : bData.amount,
                status: isPaid ? "Paid" : bData.status,
                paidAmount: isPaid ? Number(paymentMatch?.amount || fee) : bData.paidAmount || 0,
                paymentDate: paymentMatch?.paymentDate || bData.paymentDate || "",
                paymentMethod: paymentMatch?.paymentMethod || bData.paymentMethod || "",
                paymentId: paymentMatch?.receiptNumber || paymentMatch?.paymentId || bData.paymentId || "",
                updatedAt: serverTimestamp(),
              });
              billsSynced++;
            } catch (err) {
              console.warn("[Reconcile] Could not sync bill doc:", err);
            }
          }
        }
      }

      // 4B. Update existing garbageBills if needed
      for (const gbDoc of gbSnap.docs) {
        const gbData = gbDoc.data();
        const resident = residentMapById[gbData.residentId];
        if (resident) {
          const fee = Number(resident.charge) > 0 ? Number(resident.charge) : effectiveStandardFee;
          const paymentMatch = (payments || []).find(
            (p) =>
              (p.residentId === resident.id || p.residentId === resident.uid || (resident.mobile && p.mobile && p.mobile.includes(resident.mobile.slice(-10)))) &&
              p.month === selectedMonth &&
              Number(p.year) === Number(selectedYear)
          );
          const isPaid = Boolean(paymentMatch);

          const needsAmountUpdate = Number(gbData.amount) <= 0 && fee > 0;
          const needsPaymentSync = isPaid && gbData.status !== "Paid";

          if (needsAmountUpdate || needsPaymentSync) {
            try {
              await updateDoc(doc(db, "garbageBills", gbDoc.id), {
                amount: needsAmountUpdate ? fee : gbData.amount,
                status: isPaid ? "Paid" : gbData.status,
                paidAmount: isPaid ? Number(paymentMatch?.amount || fee) : gbData.paidAmount || 0,
                paymentDate: paymentMatch?.paymentDate || gbData.paymentDate || "",
                paymentMethod: paymentMatch?.paymentMethod || gbData.paymentMethod || "",
                collectedBy: paymentMatch?.collector || gbData.collectedBy || "",
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              console.warn("[Reconcile] Could not sync garbageBill doc:", err);
            }
          }
        }
      }

      // 4C. Create missing bills for current cycle
      for (const resident of participatingResidents) {
        const fee = Number(resident.charge) > 0 ? Number(resident.charge) : effectiveStandardFee;
        const paymentMatch = (payments || []).find(
          (p) =>
            (p.residentId === resident.id || p.residentId === resident.uid || (resident.mobile && p.mobile && p.mobile.includes(resident.mobile.slice(-10)))) &&
            p.month === selectedMonth &&
            Number(p.year) === Number(selectedYear)
        );
        const isPaid = Boolean(paymentMatch);

        // Ensure bill doc exists in bills
        if (!existingBillResIds.has(resident.id)) {
          await addDoc(collection(db, "bills"), {
            residentId: resident.id,
            residentName: resident.owner || resident.name || "Resident",
            flat: resident.flat || "",
            block: resident.block || "General",
            amount: fee,
            status: isPaid ? "Paid" : "Pending",
            paidAmount: isPaid ? Number(paymentMatch.amount || fee) : 0,
            month: selectedMonth,
            year: Number(selectedYear),
            dueDate: `10 ${selectedMonth} ${selectedYear}`,
            paymentDate: paymentMatch?.paymentDate || "",
            paymentMethod: paymentMatch?.paymentMethod || "",
            paymentId: paymentMatch?.receiptNumber || paymentMatch?.paymentId || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          billsSynced++;
        }

        // Ensure bill doc exists in garbageBills
        if (!existingGbResIds.has(resident.id)) {
          const accountId = accMap.get(resident.id) || "";
          await addDoc(collection(db, "garbageBills"), {
            accountId,
            residentId: resident.id,
            month: selectedMonth,
            year: Number(selectedYear),
            amount: fee,
            status: isPaid ? "Paid" : "Pending",
            paidAmount: isPaid ? Number(paymentMatch.amount || fee) : 0,
            dueDate: `10 ${selectedMonth} ${selectedYear}`,
            paymentDate: paymentMatch?.paymentDate || "",
            paymentMethod: paymentMatch?.paymentMethod || "",
            collectedBy: paymentMatch?.collector || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (billSyncErr) {
      console.warn("[Reconcile] Could not sync missing bills to Firestore:", billSyncErr);
    }

    const messages = [];
    if (accountsCreated > 0) messages.push(`${accountsCreated} accounts created`);
    if (chargesSynced > 0) messages.push(`${chargesSynced} charges standardized at ₹${effectiveStandardFee}`);
    if (billsSynced > 0) messages.push(`${billsSynced} monthly bills synchronized`);
    if (statusSynced > 0) messages.push(`${statusSynced} statuses synchronized`);
    if (orphansRelinked > 0) messages.push(`${orphansRelinked} accounts relinked`);
    if (orphansCleaned > 0) messages.push(`${orphansCleaned} orphan records cleaned`);
    if (flatsLinked > 0) messages.push(`${flatsLinked} flats linked`);

    if (!isSilent) {
      if (messages.length > 0) {
        toast.success(`Data synchronized: ${messages.join(", ")}`);
      } else {
        toast.success("All residents, garbage accounts, and monthly bills are 100% synchronized.");
      }
    }

    return {
      accountsCreated,
      chargesSynced,
      billsSynced,
      statusSynced,
      orphansRelinked,
      orphansCleaned,
      flatsLinked,
      totalParticipating: participatingResidents.length,
      effectiveFee: effectiveStandardFee,
    };
  }

  // =============================================
  // Auto-reconcile: create GC accounts for participating residents
  // Runs once per admin session after data loads
  // =============================================

  const reconcileRanRef = useRef(false);

  useEffect(() => {
    if (
      reconcileRanRef.current ||
      !user ||
      user.role !== "admin" ||
      !residents ||
      residents.length === 0
    ) {
      return;
    }

    // Mark as ran immediately to prevent re-runs
    reconcileRanRef.current = true;

    // Run reconciliation silently (no toast on startup unless manually initiated)
    reconcileGarbageAccounts({ silent: true }).catch(console.error);
  }, [user, residents, garbageAccounts]);

  // =============================================
  // Provider — expose RESOLVED data, not raw
  // =============================================

  return (
    <GarbageContext.Provider
      value={{
        // Resolved data (names from master collections)
        garbageAccounts: resolvedAccounts,
        garbageBills: resolvedBills,
        garbageCollections,
        garbageCollectors: resolvedCollectors,
        garbageRoutes,
        garbageSettings,
        garbageRequests: resolvedRequests,
        garbageLogs,
        loading,

        // Master data access
        residents,
        collectors,
        getResident,
        getCollector,

        // Billing period
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,

        // Account CRUD
        addAccount,
        updateAccount,
        deleteAccount,
        toggleAccountStatus,
        relinkAccount,

        // Bill operations
        generateBills,
        recordPayment,
        deleteBill,

        // Collector assignments
        addGarbageCollectorAssignment,
        updateGarbageCollectorAssignment,
        deleteGarbageCollectorAssignment,

        // Routes
        addRoute,
        updateRoute,
        deleteRoute,

        // Settings
        updateGarbageSettings,

        // Requests
        submitRequest,
        approveRequest,
        rejectRequest,

        // Collection marking
        markCollection,

        // Collector account assignment
        assignCollectorToAccount,

        // Data reconciliation
        reconcileGarbageAccounts,
      }}
    >
      {children}
    </GarbageContext.Provider>
  );
}

export function useGarbage() {
  return useContext(GarbageContext);
}
