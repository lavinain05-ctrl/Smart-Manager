import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaMoneyBillWave,
  FaSearch,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaUserPlus,
  FaCheckCircle,
  FaReceipt,
  FaFileDownload,
  FaTimes,
  FaShieldAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import ResidentForm from "../../components/forms/ResidentForm";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";

import { collectResidentPayment, createPendingBill } from "../../utils/collectPayment";
import { isGcParticipating } from "../../services/statisticsService";
import { formatResidentFloor } from "../../services/propertyService";
import { isPriorToResidentBillingStart } from "../../utils/billingCycle";
import {
  subscribeSpecialCollections,
  subscribeAllSpecialPayments,
  recordOfflineSpecialCollectionPayment,
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { logActivity } from "../../services/activityLogService";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

export default function CommitteeCollect({ defaultModule }) {
  const { user } = useAuth();
  const { residents, addResident } = useResidents();
  const { payments, addPayment } = usePayments();
  const { bills } = useBills();
  const { settings } = useSettings();

  const [searchParams] = useSearchParams();
  const queryModule = defaultModule || searchParams.get("module") || searchParams.get("type");

  const [permissions, setPermissions] = useState(user?.permissions || {});

  // Listen for real-time permissions on current user
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists() && snap.data().permissions) {
        setPermissions(snap.data().permissions);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const hasGarbage = Boolean(permissions.canCollectGarbage);
  const hasSpecial = Boolean(permissions.canCollectSpecial);
  const canManageResidents = Boolean(permissions.canManageResidents);

  const [activeModule, setActiveModule] = useState(() => {
    if (queryModule === "special" || queryModule === "special_collections") return "special_collections";
    if (queryModule === "garbage") return "garbage";
    return hasGarbage ? "garbage" : hasSpecial ? "special_collections" : "garbage";
  });

  // Keep activeModule valid if permissions or query param update
  useEffect(() => {
    if (queryModule === "special" || queryModule === "special_collections") {
      setActiveModule("special_collections");
    } else if (queryModule === "garbage") {
      setActiveModule("garbage");
    } else if (!hasGarbage && hasSpecial) {
      setActiveModule("special_collections");
    } else if (hasGarbage && !hasSpecial) {
      setActiveModule("garbage");
    }
  }, [queryModule, hasGarbage, hasSpecial]);

  // ─── 1. GARBAGE COLLECTION STATE ───
  const [garbageSearch, setGarbageSearch] = useState("");
  const [garbageFilter, setGarbageFilter] = useState("all"); // all, pending, paid
  const [selectedResident, setSelectedResident] = useState(null);
  const [openGarbageModal, setOpenGarbageModal] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);

  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  function isGarbagePaid(residentId) {
    return payments.some(
      (payment) =>
        payment.residentId === residentId &&
        ((payment.month === currentMonth && Number(payment.year) === Number(currentYear)) ||
          (payment.isAdvance &&
            Array.isArray(payment.coveredMonths) &&
            payment.coveredMonths.some(
              (cm) => cm.month === currentMonth && Number(cm.year) === Number(currentYear)
            )))
    );
  }

  async function handleAddResident(formData) {
    try {
      const charge = Number(formData.charge) || Number(settings?.monthlyCharge) || 80;
      const result = await addResident({
        ...formData,
        status: "Active",
        garbageStatus: formData.garbageStatus || "participating",
        collectorId: user?.uid || "",
        collectorName: user?.name || user?.email || "Committee Member",
        createdBy: "Committee",
        createdById: user?.uid,
        createdByName: `${user?.name || "Committee"} (${user?.designation || "Executive Member"})`,
        charge,
        createdAt: new Date().toISOString(),
        accessProvenance: {
          grantedByUid: user?.uid || "",
          grantedByName: user?.name || "Committee Official",
          grantedByRole: "committee",
          grantedByDesignation: user?.designation || "Executive Member",
          grantedAt: new Date().toISOString(),
          channel: "committee_portal",
        },
      });

      if (!result) return false;

      const createdResidentId = result.id || (typeof result === "string" ? result : "");
      const createdResident = {
        id: createdResidentId,
        ...formData,
        charge,
      };

      // 1. If Payment is marked as "Paid", immediately record collection & generate receipt
      if (formData.paymentStatus === "Paid" && formData.garbageStatus !== "not_participating") {
        const payMonth = formData.billingMonth || currentMonth;
        const payYear = Number(formData.billingYear || currentYear);
        const payAmount = Number(formData.paymentAmount) || charge;
        const payMethod = formData.paymentMethod || "Cash";

        const receipt = await collectResidentPayment({
          resident: createdResident,
          month: payMonth,
          year: payYear,
          paymentData: {
            amount: payAmount,
            method: payMethod,
            referenceNumber: formData.paymentReference || "",
            remarks: formData.paymentRemarks || "Initial collection by Committee upon onboarding",
            date: new Date().toLocaleDateString("en-IN"),
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            collectorName: user?.name || "Committee Official",
            collectorRole: "committee",
          },
          bills: bills || [],
          collector: user?.name || "Committee Official",
          collectorId: user?.uid,
        });

        setShowAddResident(false);
        if (receipt) {
          setSuccessReceipt(receipt);
          toast.success(`Resident added & payment recorded! Receipt ${receipt.receiptNumber} issued.`);
        } else {
          toast.success("Resident added! Ready for collection.");
        }
        return true;
      }

      // 2. If Payment is marked as "Pending", create pending bill record for that month/year
      if (formData.paymentStatus === "Pending" && formData.garbageStatus !== "not_participating") {
        const billMonth = formData.billingMonth || currentMonth;
        const billYear = Number(formData.billingYear || currentYear);

        await createPendingBill({
          resident: createdResident,
          month: billMonth,
          year: billYear,
          amount: charge,
          collectorId: user?.uid,
          collectorName: user?.name || "Committee Official",
        });

        setShowAddResident(false);
        toast.success(`Resident added! Bill for ${billMonth} ${billYear} marked as Pending.`);
        return true;
      }

      setShowAddResident(false);
      toast.success("Resident added! Ready for collection.");
      return true;
    } catch (err) {
      toast.error(err.message || "Failed to add resident");
      return false;
    }
  }

  const filteredGarbageResidents = useMemo(() => {
    return residents
      .filter((resident) => isGcParticipating(resident))
      .filter((resident) => !isPriorToResidentBillingStart(resident, currentMonth, currentYear))
      .filter((resident) => {
        const query = garbageSearch.toLowerCase();
        const matchesQuery =
          (resident.flat || "").toLowerCase().includes(query) ||
          (resident.owner || "").toLowerCase().includes(query) ||
          (resident.name || "").toLowerCase().includes(query) ||
          (resident.mobile || resident.phone || "").includes(query);
        if (!matchesQuery) return false;

        const paid = isGarbagePaid(resident.id);
        if (garbageFilter === "paid") return paid;
        if (garbageFilter === "pending") return !paid;
        return true;
      });
  }, [residents, garbageSearch, garbageFilter, payments, currentMonth, currentYear]);

  async function handleGarbageCollect(paymentData) {
    if (!selectedResident) return;
    const toastId = toast.loading("Processing collection & updating records...");
    try {
      const success = await collectResidentPayment({
        resident: selectedResident,
        month: currentMonth,
        year: currentYear,
        paymentData: {
          ...paymentData,
          collectorRole: "committee",
          collectorDesignation: user?.designation || "Executive Member",
          collectorName: user?.name || "Committee Official",
          referenceNumber: paymentData.referenceNumber || "",
        },
        bills,
        addPayment,
        collector: `${user?.name || "Committee"} (${user?.designation || "Executive Member"})`,
        collectorId: user?.uid,
      });

      if (success) {
        // Also log to garbageCollections
        try {
          await addDoc(collection(db, "garbageCollections"), {
            residentId: selectedResident.id || "",
            residentName: selectedResident.owner || selectedResident.name || "Resident",
            flat: selectedResident.flat || selectedResident.flatNumber || "",
            block: selectedResident.block || "",
            amount: Number(paymentData.amount) || 0,
            month: currentMonth,
            year: currentYear,
            paymentMethod: paymentData.method || "Cash",
            isAdvance: Boolean(paymentData.isAdvance),
            advanceDuration: paymentData.coveredMonths?.length || 1,
            collectorId: user?.uid || "",
            collectorName: user?.name || "Committee Official",
            collectorRole: "committee",
            collectorDesignation: user?.designation || "Executive Member",
            date: new Date().toLocaleDateString("en-IN"),
            createdAt: serverTimestamp(),
          });
        } catch (gcErr) {
          console.warn("Could not log garbageCollections doc:", gcErr.message);
        }

        // Activity Log
        try {
          await logActivity({
            action: `Committee Collection: ₹${paymentData.amount} from ${selectedResident.owner || selectedResident.flat} (Garbage Fee)`,
            category: "payment",
            performedBy: "committee",
            performedByName: `${user?.name || "Committee"} (${user?.designation || "Executive Member"})`,
            targetId: selectedResident.id || "",
            targetName: selectedResident.owner || selectedResident.name || selectedResident.flat || "Resident",
            details: `Method: ${paymentData.method}, Period: ${paymentData.isAdvance ? "Advance Multi-Month" : `${currentMonth} ${currentYear}`}`,
          });
        } catch (actErr) {
          console.warn("Could not log activity:", actErr.message);
        }

        toast.success("Payment recorded & synchronized!", { id: toastId });
        setOpenGarbageModal(false);
        setSelectedResident(null);
        setSuccessReceipt(success);
      } else {
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Collection failed", { id: toastId });
    }
  }

  // ─── 2. SPECIAL COLLECTIONS STATE ───
  const [specialCollections, setSpecialCollections] = useState([]);
  const [specialPayments, setSpecialPayments] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [specialSearch, setSpecialSearch] = useState("");
  const [specialFilter, setSpecialFilter] = useState("all"); // all, pending, contributed

  // Contribution Modal State
  const [collectingResident, setCollectingResident] = useState(null);
  const [isExternal, setIsExternal] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectSubmitting, setCollectSubmitting] = useState(false);
  const [collectFormData, setCollectFormData] = useState({
    contributorName: "",
    flatNumber: "",
    block: "",
    mobileNumber: "",
    amount: "",
    paymentMethod: "Cash",
    remarks: "",
  });

  // Official Receipt Modal State (Garbage & Special Collection with direct print)
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Subscribe to active Special Collections authorized for this committee member & all special payments
  useEffect(() => {
    const unsubCol = subscribeSpecialCollections((list) => {
      // Active campaigns created by Admin
      const activeList = list.filter((c) => c.status === "active");

      // Scope check: if restricted to specific campaigns, filter by authorized IDs
      const isSpecific = permissions?.specialCollectionScope === "specific";
      const allowedIds = Array.isArray(permissions?.allowedSpecialCollections)
        ? new Set(permissions.allowedSpecialCollections)
        : null;

      const authorizedList = isSpecific && allowedIds
        ? activeList.filter((c) => allowedIds.has(c.id))
        : activeList;

      setSpecialCollections(authorizedList);
      if (authorizedList.length > 0) {
        setSelectedCampaignId((prev) => {
          if (prev && authorizedList.some((c) => c.id === prev)) {
            return prev;
          }
          return authorizedList[0].id;
        });
      } else {
        setSelectedCampaignId("");
      }
    });

    const unsubPay = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list);
    });

    return () => {
      unsubCol();
      unsubPay();
    };
  }, [permissions?.specialCollectionScope, JSON.stringify(permissions?.allowedSpecialCollections || [])]);

  // Selected Campaign Object
  const currentCampaign = useMemo(() => {
    return (
      specialCollections.find((c) => c.id === selectedCampaignId) ||
      specialCollections[0] ||
      null
    );
  }, [specialCollections, selectedCampaignId]);

  // Payments for current campaign
  const currentCampaignPayments = useMemo(() => {
    if (!currentCampaign) return [];
    return specialPayments.filter(
      (p) => p.collectionId === currentCampaign.id && p.status === "confirmed"
    );
  }, [specialPayments, currentCampaign]);

  // Check if resident has contributed to current campaign
  function getResidentContribution(resident) {
    if (!currentCampaign) return null;
    return currentCampaignPayments.find(
      (p) =>
        (p.residentId && p.residentId === resident.id) ||
        (p.flatNumber &&
          resident.flatNumber &&
          p.flatNumber.toLowerCase() === resident.flatNumber.toLowerCase()) ||
        (p.flatNumber &&
          resident.flat &&
          p.flatNumber.toLowerCase() === resident.flat.toLowerCase())
    );
  }

  // Filtered residents for Special Collections
  const filteredSpecialResidents = useMemo(() => {
    return residents
      .slice()
      .sort((a, b) => (a.flat || a.flatNumber || "").localeCompare(b.flat || b.flatNumber || ""))
      .filter((resident) => {
        const query = specialSearch.toLowerCase();
        const matchesQuery =
          (resident.flatNumber || "").toLowerCase().includes(query) ||
          (resident.flat || "").toLowerCase().includes(query) ||
          (resident.name || "").toLowerCase().includes(query) ||
          (resident.owner || "").toLowerCase().includes(query) ||
          (resident.mobile || resident.phone || "").includes(query);
        if (!matchesQuery) return false;

        const contribution = getResidentContribution(resident);
        if (specialFilter === "contributed") return Boolean(contribution);
        if (specialFilter === "pending") return !contribution;
        return true;
      });
  }, [residents, specialSearch, specialFilter, currentCampaignPayments]);

  // Open Collect Modal for a resident
  function handleOpenSpecialCollect(resident) {
    if (!currentCampaign) {
      toast.error("Please select an active campaign first.");
      return;
    }
    setCollectingResident(resident);
    setIsExternal(false);
    setCollectFormData({
      contributorName: resident.name || resident.owner || "",
      flatNumber: resident.flatNumber || resident.flat || "",
      block: resident.block || "",
      mobileNumber: resident.mobileNumber || resident.mobile || "",
      amount: currentCampaign.amountType === "fixed" ? String(currentCampaign.fixedAmount || "") : "",
      paymentMethod: "Cash",
      remarks: "",
    });
    setCollectModalOpen(true);
  }

  // Open Collect Modal for an external contributor
  function handleOpenExternalCollect() {
    if (!currentCampaign) {
      toast.error("Please select an active campaign first.");
      return;
    }
    setCollectingResident(null);
    setIsExternal(true);
    setCollectFormData({
      contributorName: "",
      flatNumber: "",
      block: "",
      mobileNumber: "",
      amount: currentCampaign.amountType === "fixed" ? String(currentCampaign.fixedAmount || "") : "",
      paymentMethod: "Cash",
      remarks: "",
    });
    setCollectModalOpen(true);
  }

  // Submit Special Collection Payment
  async function handleSubmitSpecialCollect(e) {
    e.preventDefault();
    if (!currentCampaign) return;

    if (!collectFormData.contributorName.trim()) {
      toast.error("Please provide contributor name.");
      return;
    }

    const numAmount = parseFloat(collectFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid contribution amount.");
      return;
    }

    try {
      setCollectSubmitting(true);
      const receipt = await recordOfflineSpecialCollectionPayment(
        {
          collectionId: currentCampaign.id,
          collectionName: currentCampaign.name || currentCampaign.title || "Special Collection",
          purpose: currentCampaign.purpose || currentCampaign.name || "Special Contribution",
          contributorType: isExternal ? "external" : "resident",
          residentId: collectingResident ? collectingResident.id : "",
          userId: collectingResident?.userId || collectingResident?.uid || collectingResident?.id || "",
          contributorName: collectFormData.contributorName.trim(),
          flatNumber: collectFormData.flatNumber.trim(),
          block: collectFormData.block.trim(),
          mobileNumber: collectFormData.mobileNumber.trim(),
          amount: numAmount,
          paymentMethod: collectFormData.paymentMethod || "Cash",
          paymentDate: new Date().toISOString().split("T")[0],
          collectorId: user?.uid || "",
          collectorName: `${user?.name || "Committee"} (${user?.designation || "Executive Member"})`,
          remarks: collectFormData.remarks.trim(),
        },
        user
      );

      // Also ensure standard payments collection has committee metadata for Admin daily reports
      await addDoc(collection(db, "payments"), {
        residentId: collectingResident ? collectingResident.id : "",
        residentName: collectFormData.contributorName.trim(),
        flat: collectFormData.flatNumber.trim(),
        block: collectFormData.block.trim(),
        mobile: collectFormData.mobileNumber.trim(),
        amount: numAmount,
        type: "Special Collection",
        collectionType: "special",
        specialCampaignName: currentCampaign.name,
        month: currentCampaign.name,
        year: new Date().getFullYear(),
        paymentMethod: collectFormData.paymentMethod || "Cash",
        paymentMode: collectFormData.paymentMethod || "Cash",
        receiptNumber: receipt.receiptNumber,
        receiptNo: receipt.receiptNumber,
        status: "Completed",
        collectorId: user?.uid || "",
        collectorName: user?.name || "Committee Official",
        collectorRole: "committee",
        collectorDesignation: user?.designation || "Executive Member",
        collectedBy: `${user?.name || "Official"} (${user?.designation || "Committee"})`,
        remarks: collectFormData.remarks.trim(),
        createdAt: serverTimestamp(),
      });

      // Log Activity
      await logActivity({
        action: `Committee Special Contribution: ₹${numAmount} from ${collectFormData.contributorName} (${currentCampaign.name})`,
        category: "payment",
        performedBy: "committee",
        performedByName: `${user?.name || "Committee"} (${user?.designation || "Executive Member"})`,
        targetId: collectingResident ? collectingResident.id : "",
        targetName: collectFormData.contributorName,
        details: `Receipt #${receipt.receiptNumber}, Campaign: ${currentCampaign.name}`,
      });

      toast.success(`Contribution recorded! Receipt ${receipt.receiptNumber} issued.`);
      setCollectModalOpen(false);
      setSuccessReceipt(receipt);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to record contribution.");
    } finally {
      setCollectSubmitting(false);
    }
  }

  // If user has neither permission
  if (!hasGarbage && !hasSpecial) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-8 text-center max-w-lg mx-auto mt-12 shadow-sm space-y-3">
        <FaShieldAlt className="text-amber-500 text-5xl mx-auto" />
        <h2 className="text-xl font-extrabold text-amber-900 dark:text-amber-100">Collection Permission Required</h2>
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          Your committee profile has not been assigned fee collection privileges yet. Please contact the society administrator to grant <strong>"Collect Garbage Fees"</strong> or <strong>"Collect Special Campaign Fees"</strong> on your committee account.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* ─── Top Header & Assigned Powers Switcher ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Committee Collection Desk
              </h1>
              <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                🏛️ {user?.designation || "Executive Member"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Authorized collection terminal for {user?.name || "Committee Official"}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            <PrinterQuickAction />

            {/* Module Switcher Tabs (When committee member has both powers) */}
            {hasGarbage && hasSpecial && (
              <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl gap-1 border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setActiveModule("garbage")}
                  className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
                    activeModule === "garbage"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FaTrashAlt className="text-xs" />
                  <span>Garbage</span>
                </button>
                <button
                  onClick={() => setActiveModule("special_collections")}
                  className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
                    activeModule === "special_collections"
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FaHandHoldingHeart className="text-xs" />
                  <span>Special</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MODULE 1: GARBAGE COLLECTION (WITH MULTIPLE MONTHS OPTION)    */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeModule === "garbage" && hasGarbage && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  <FaTrashAlt /> Garbage Collection Module
                </span>
                <h2 className="text-lg font-black mt-0.5">
                  Billing Cycle: {currentMonth} {currentYear}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {canManageResidents && (
                  <button
                    type="button"
                    onClick={() => setShowAddResident(true)}
                    className="bg-white text-emerald-800 hover:bg-emerald-50 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <FaUserPlus /> Add Resident
                  </button>
                )}
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm hidden sm:inline-block">
                  Advance / Multi-Month Enabled
                </span>
              </div>
            </div>

            {/* Garbage Search & Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="relative">
                <FaSearch className="absolute left-4 top-3.5 text-slate-400 text-sm" />
                <input
                  value={garbageSearch}
                  onChange={(e) => setGarbageSearch(e.target.value)}
                  placeholder="Search by flat, resident, or mobile number..."
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2">
                <button
                  onClick={() => setGarbageFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  All ({residents.filter((r) => isGcParticipating(r)).length})
                </button>
                <button
                  onClick={() => setGarbageFilter("pending")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "pending"
                      ? "bg-red-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setGarbageFilter("paid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "paid"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  Paid
                </button>
              </div>
            </div>

            {/* Garbage Residents List */}
            <div className="space-y-2.5">
              {filteredGarbageResidents.map((resident) => {
                const paid = isGarbagePaid(resident.id);
                return (
                  <div
                    key={resident.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-4 flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-base">
                          Flat {resident.flat || resident.flatNumber || "—"}
                        </span>
                        <span className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">
                          {formatResidentFloor(resident.floor) || "Ground Floor"}
                        </span>
                        {resident.block && (
                          <span className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            {resident.block}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        {resident.name || resident.owner || "Resident"}
                        {resident.mobile || resident.phone ? ` • ${resident.mobile || resident.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          paid
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                        }`}
                      >
                        {paid ? "Paid" : "Pending"}
                      </span>

                      <button
                        disabled={paid}
                        onClick={() => {
                          setSelectedResident(resident);
                          setOpenGarbageModal(true);
                        }}
                        className={`px-4 py-2 rounded-xl text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition cursor-pointer ${
                          paid
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/25"
                        }`}
                      >
                        <FaMoneyBillWave />
                        {paid ? "Collected" : "Collect"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredGarbageResidents.length === 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-10 text-center text-slate-400 dark:text-slate-500 text-sm border border-slate-200 dark:border-slate-800">
                  No garbage collection residents found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MODULE 2: SPECIAL COLLECTIONS (CAMPAIGNS CREATED BY ADMIN)     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeModule === "special_collections" && hasSpecial && (
          <div className="space-y-4">
            {specialCollections.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs p-8 text-center space-y-3 border border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 flex items-center justify-center text-xl mx-auto">
                  <FaHandHoldingHeart />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {permissions?.specialCollectionScope === "specific"
                    ? "No Assigned Campaigns Active"
                    : "No Active Special Collections"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {permissions?.specialCollectionScope === "specific"
                    ? "Your account has selective permissions for particular special collections, but none of your assigned campaigns are currently active. Please contact an administrator if you need access to another campaign."
                    : "There are currently no active special collection campaigns created by the Admin. When the administrator launches a campaign (e.g. Festival, Maintenance, Emergency), it will automatically appear here for collection."}
                </p>
              </div>
            ) : (
              <>
                {/* Active Campaign Selector / Banner */}
                <div className="bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <FaHandHoldingHeart className="text-indigo-400" /> Admin Created Special Campaign
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <h2 className="text-xl font-black text-white">{currentCampaign?.name}</h2>
                        {permissions?.specialCollectionScope === "specific" ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Assigned ({specialCollections.length} allowed)
                          </span>
                        ) : (
                          <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Full Campaign Access
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-200 mt-0.5">{currentCampaign?.purpose}</p>
                    </div>

                    {/* Campaign Switcher Dropdown (Existing Admin Campaigns) */}
                    {specialCollections.length > 1 && (
                      <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm border border-white/10">
                        <select
                          value={selectedCampaignId}
                          onChange={(e) => setSelectedCampaignId(e.target.value)}
                          className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
                        >
                          {specialCollections.map((col) => (
                            <option key={col.id} value={col.id} className="text-slate-900 bg-white">
                              {col.name} ({col.collectionType || "Campaign"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Campaign Progress Bar & Metrics */}
                  <div className="pt-3 border-t border-indigo-500/30 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-indigo-300 block text-[11px]">Requirement</span>
                      <span className="font-bold text-sm text-white">
                        {currentCampaign?.amountType === "fixed"
                          ? `₹${currentCampaign?.fixedAmount} Fixed`
                          : "Flexible Contribution"}
                      </span>
                    </div>

                    <div>
                      <span className="text-indigo-300 block text-[11px]">Collected So Far</span>
                      <span className="font-bold text-sm text-emerald-400">
                        ₹
                        {currentCampaignPayments
                          .reduce((s, p) => s + Number(p.amount || 0), 0)
                          .toLocaleString("en-IN")}{" "}
                        ({currentCampaignPayments.length} contributions)
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-indigo-300 block text-[11px]">Target Goal</span>
                      <span className="font-bold text-sm text-white">
                        {currentCampaign?.targetAmount
                          ? `₹${Number(currentCampaign.targetAmount).toLocaleString("en-IN")}`
                          : "Open-ended"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions & Filters */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-3.5 text-slate-400 text-sm" />
                      <input
                        value={specialSearch}
                        onChange={(e) => setSpecialSearch(e.target.value)}
                        placeholder="Search by flat, resident, or mobile number..."
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Quick Button for Guest / External Contributor */}
                    <button
                      onClick={handleOpenExternalCollect}
                      className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                      <FaUserPlus /> + External / Guest
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSpecialFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        specialFilter === "all"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      All Residents ({residents.length})
                    </button>
                    <button
                      onClick={() => setSpecialFilter("pending")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        specialFilter === "pending"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => setSpecialFilter("contributed")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        specialFilter === "contributed"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      Contributed ({currentCampaignPayments.length})
                    </button>
                  </div>
                </div>

                {/* Special Residents List */}
                <div className="space-y-2.5">
                  {filteredSpecialResidents.map((resident) => {
                    const contribution = getResidentContribution(resident);
                    return (
                      <div
                        key={resident.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-4 flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-base">
                              Flat {resident.flatNumber || resident.flat || "—"}
                            </span>
                            <span className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300">
                              {formatResidentFloor(resident.floor) || "Ground Floor"}
                            </span>
                            {resident.block && (
                              <span className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                {resident.block}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                            {resident.name || resident.owner || "Resident"}
                            {resident.mobileNumber || resident.mobile
                              ? ` • ${resident.mobileNumber || resident.mobile}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {contribution ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold px-2.5 py-1 rounded-full text-xs">
                                <FaCheckCircle className="text-emerald-600 dark:text-emerald-400 text-[10px]" />
                                Contributed ₹{contribution.amount}
                              </span>
                              <button
                                onClick={() =>
                                  generateSpecialCollectionReceipt({
                                    ...contribution,
                                    collectionName: currentCampaign.name,
                                    purpose: currentCampaign.purpose,
                                    contributorType: "Resident",
                                  })
                                }
                                title="Download PDF Receipt"
                                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs transition cursor-pointer"
                              >
                                <FaFileDownload />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenSpecialCollect(resident)}
                              className="px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                            >
                              <FaMoneyBillWave />
                              Collect
                              {currentCampaign.amountType === "fixed"
                                ? ` ₹${currentCampaign.fixedAmount}`
                                : ""}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredSpecialResidents.length === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs p-10 text-center text-slate-400 dark:text-slate-500 text-sm border border-slate-200 dark:border-slate-800">
                      No residents found matching your criteria.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. GARBAGE PAYMENT MODAL (WITH MULTIPLE MONTHS OPTION) ─── */}
      <PaymentModal
        open={openGarbageModal}
        resident={selectedResident}
        onClose={() => {
          setOpenGarbageModal(false);
          setSelectedResident(null);
        }}
        onCollect={handleGarbageCollect}
      />

      {/* ─── 4. SPECIAL CONTRIBUTION COLLECT MODAL ─── */}
      {collectModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                <FaHandHoldingHeart className="text-indigo-600 dark:text-indigo-400" />
                Collect Special Contribution
              </h3>
              <button
                onClick={() => setCollectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 p-3.5 rounded-2xl text-xs text-indigo-900 dark:text-indigo-200">
              <span className="font-bold block text-sm">{currentCampaign?.name}</span>
              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 block mt-0.5">
                {currentCampaign?.purpose} •{" "}
                {currentCampaign?.amountType === "fixed"
                  ? `₹${currentCampaign.fixedAmount} Fixed`
                  : "Flexible Amount"}
              </span>
            </div>

            <form onSubmit={handleSubmitSpecialCollect} className="space-y-3.5">
              {/* Contributor Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contributor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={collectFormData.contributorName}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({
                      ...prev,
                      contributorName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Flat & Block */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Flat / Unit</label>
                  <input
                    type="text"
                    value={collectFormData.flatNumber}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({
                        ...prev,
                        flatNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. D-101"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Block / Section</label>
                  <input
                    type="text"
                    value={collectFormData.block}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({
                        ...prev,
                        block: e.target.value,
                      }))
                    }
                    placeholder="e.g. D-Block"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={collectFormData.mobileNumber}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({
                      ...prev,
                      mobileNumber: e.target.value,
                    }))
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={collectFormData.amount}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={collectFormData.paymentMethod}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Offline UPI">Offline UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={collectFormData.remarks}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({
                      ...prev,
                      remarks: e.target.value,
                    }))
                  }
                  placeholder="e.g. Collected at office counter"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/25 transition cursor-pointer active:scale-95"
                >
                  <FaReceipt />
                  {collectSubmitting ? "Issuing..." : "Collect & Issue Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 5. OFFICIAL RECEIPT SUCCESS MODAL (WITH WORKING DIRECT PRINT & PDF) ─── */}
      <PaymentReceiptSuccessModal
        open={Boolean(successReceipt)}
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />

      {/* Add Resident Drawer */}
      {showAddResident && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 flex justify-between items-center z-10 shadow-md">
              <div className="flex items-center gap-3">
                <FaUserPlus className="text-xl" />
                <h2 className="text-xl font-bold">Add New Resident</h2>
              </div>
              <button
                onClick={() => setShowAddResident(false)}
                className="text-xl hover:text-emerald-200 cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6">
              <ResidentForm
                onSave={handleAddResident}
                onClose={() => setShowAddResident(false)}
                defaultCharge={settings?.monthlyCharge || ""}
                hidePortalFields
                showCollectionPaymentFields={true}
                defaultMonth={currentMonth}
                defaultYear={currentYear}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
