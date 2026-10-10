import { useMemo, useState, useEffect } from "react";
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
  FaFilter,
  FaPhone,
  FaCalendarAlt,
  FaPrint,
} from "react-icons/fa";
import toast from "react-hot-toast";

import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import ResidentReceiptsListModal from "../../components/collections/ResidentReceiptsListModal";
import ResidentForm from "../../components/forms/ResidentForm";
import CollectorMonthBar from "../../components/collections/CollectorMonthBar";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";
import { useBilling } from "../../context/BillingContext";

import { collectResidentPayment, createPendingBill } from "../../utils/collectPayment";
import { isGcParticipating } from "../../services/statisticsService";
import { isPriorToResidentBillingStart } from "../../utils/billingCycle";
import {
  subscribeSpecialCollections,
  subscribeAllSpecialPayments,
  recordOfflineSpecialCollectionPayment,
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { formatResidentFloor } from "../../services/propertyService";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

export default function CollectorCollect() {
  const { user } = useAuth();
  const { residents, addResident } = useResidents();
  const { payments, addPayment } = usePayments();
  const { bills } = useBills();
  const { settings } = useSettings();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useBilling();

  // Collector Assigned Powers
  const assignedModules = useMemo(() => {
    if (Array.isArray(user?.assignedModules) && user.assignedModules.length > 0) {
      return user.assignedModules;
    }
    return ["garbage"];
  }, [user?.assignedModules]);

  const hasGarbage = assignedModules.includes("garbage");
  const hasSpecial = assignedModules.includes("special_collections");

  const [activeModule, setActiveModule] = useState(
    hasGarbage ? "garbage" : "special_collections"
  );

  // If user permissions change, keep activeModule valid
  useEffect(() => {
    if (!hasGarbage && hasSpecial) {
      setActiveModule("special_collections");
    } else if (hasGarbage && !hasSpecial) {
      setActiveModule("garbage");
    }
  }, [hasGarbage, hasSpecial]);

  // ─── 1. GARBAGE COLLECTION STATE ───
  const [garbageSearch, setGarbageSearch] = useState("");
  const [garbageFilter, setGarbageFilter] = useState("all"); // all, pending, paid
  const [selectedResident, setSelectedResident] = useState(null);
  const [openGarbageModal, setOpenGarbageModal] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);

  // Helper to verify if resident is paid for the selected month/year
  function isGarbagePaid(residentOrId) {
    if (!residentOrId) return false;
    const resident =
      typeof residentOrId === "object"
        ? residentOrId
        : residents.find((r) => r.id === residentOrId);
    const resId =
      typeof residentOrId === "object" ? residentOrId.id : residentOrId;
    const flatStr = String(
      resident?.flat || resident?.flatNumber || ""
    ).toLowerCase();

    // 1. Direct payment or advance covered months in payments
    const inPayments = payments.some((payment) => {
      const matchRes =
        (resId && payment.residentId === resId) ||
        (flatStr &&
          payment.flat &&
          String(payment.flat).toLowerCase() === flatStr);
      if (!matchRes) return false;

      const direct =
        payment.month === selectedMonth &&
        Number(payment.year) === Number(selectedYear);
      const advance =
        payment.isAdvance &&
        Array.isArray(payment.coveredMonths) &&
        payment.coveredMonths.some(
          (cm) =>
            cm.month === selectedMonth &&
            Number(cm.year) === Number(selectedYear)
        );
      return direct || advance;
    });
    if (inPayments) return true;

    // 2. Bill with status Paid or Exempted
    const inBills = (bills || []).some((bill) => {
      const matchRes =
        (resId && bill.residentId === resId) ||
        (flatStr &&
          bill.flat &&
          String(bill.flat).toLowerCase() === flatStr);
      if (!matchRes) return false;

      return (
        bill.month === selectedMonth &&
        Number(bill.year) === Number(selectedYear) &&
        (bill.status === "Paid" || bill.status === "Exempted")
      );
    });
    return inBills;
  }

  // Resident Receipts Modal State
  const [receiptsModalResident, setReceiptsModalResident] = useState(null);

  function getResidentGarbagePayments(resident) {
    if (!resident) return [];
    return payments.filter(
      (p) =>
        (resident.id && p.residentId === resident.id) ||
        (resident.flat &&
          p.flat &&
          String(p.flat).toLowerCase() === String(resident.flat).toLowerCase()) ||
        (resident.flatNumber &&
          p.flat &&
          String(p.flat).toLowerCase() === String(resident.flatNumber).toLowerCase())
    );
  }

  function getResidentCurrentPayment(resident) {
    const list = getResidentGarbagePayments(resident);
    return (
      list.find(
        (p) =>
          (p.month === selectedMonth && Number(p.year) === Number(selectedYear)) ||
          (p.isAdvance &&
            Array.isArray(p.coveredMonths) &&
            p.coveredMonths.some(
              (cm) =>
                cm.month === selectedMonth &&
                Number(cm.year) === Number(selectedYear)
            ))
      ) || list[0]
    );
  }

  function getResidentSpecialPayments(resident) {
    if (!resident) return [];
    return specialPayments.filter(
      (p) =>
        p.status === "confirmed" &&
        ((resident.id && p.residentId === resident.id) ||
          (resident.flatNumber &&
            p.flatNumber &&
            String(p.flatNumber).toLowerCase() ===
              String(resident.flatNumber).toLowerCase()) ||
          (resident.flat &&
            p.flatNumber &&
            String(p.flatNumber).toLowerCase() ===
              String(resident.flat).toLowerCase()))
    );
  }

  function handlePrintGarbageReceipt(resident) {
    const payment = getResidentCurrentPayment(resident);
    if (payment) {
      printPaymentReceipt({
        ...payment,
        residentName:
          resident.name || resident.owner || payment.residentName || "Resident",
        flat: resident.flat || resident.flatNumber || payment.flat || "—",
        plotNumber: resident.plotNumber || payment.plotNumber || resident.flat || "",
        floor: resident.floor || payment.floor || "",
        unitNumber: resident.unitNumber || payment.unitNumber || "",
        personType: resident.personType || payment.personType || "",
        block: resident.block || payment.block || "",
      });
      toast.success(
        `Printing receipt for Flat ${resident.flat || resident.flatNumber || "—"}...`
      );
    } else {
      toast.error("No receipt found for this resident.");
    }
  }

  async function handleAddResident(formData) {
    try {
      const charge = Number(formData.charge) || Number(settings?.monthlyCharge) || 80;
      const result = await addResident({
        ...formData,
        status: "Active",
        garbageStatus: formData.garbageStatus || "participating",
        collectorId: user?.uid || "",
        collectorName: user?.name || user?.email || "Collector",
        createdBy: "Collector",
        createdById: user?.uid,
        createdByName: user?.name || user?.email,
        charge,
        createdAt: new Date().toISOString(),
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
        const payMonth = formData.billingMonth || selectedMonth;
        const payYear = Number(formData.billingYear || selectedYear);
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
            remarks: formData.paymentRemarks || "Initial collection upon resident onboarding",
            date: new Date().toLocaleDateString("en-IN"),
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            collectorName: user?.name || "Collector",
            collectorRole: "collector",
          },
          bills: bills || [],
          collector: user?.name || "Collector",
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
        const billMonth = formData.billingMonth || selectedMonth;
        const billYear = Number(formData.billingYear || selectedYear);

        await createPendingBill({
          resident: createdResident,
          month: billMonth,
          year: billYear,
          amount: charge,
          collectorId: user?.uid,
          collectorName: user?.name || "Collector",
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

  const garbageCounts = useMemo(() => {
    let all = 0;
    let pending = 0;
    let paid = 0;
    let notParticipating = 0;

    residents.forEach((r) => {
      all++;
      const isEligible = isGcParticipating(r) && !isPriorToResidentBillingStart(r, selectedMonth, selectedYear);
      if (!isEligible) {
        notParticipating++;
      } else if (isGarbagePaid(r)) {
        paid++;
      } else {
        pending++;
      }
    });

    return { all, pending, paid, notParticipating };
  }, [residents, payments, bills, selectedMonth, selectedYear]);

  // Monthly financial overview for the selected month
  const monthlyFinancials = useMemo(() => {
    const participating = residents.filter((r) => isGcParticipating(r) && !isPriorToResidentBillingStart(r, selectedMonth, selectedYear));
    const expected = participating.reduce(
      (sum, r) =>
        sum + (Number(r.charge) || Number(settings?.monthlyCharge) || 80),
      0
    );

    const paidInMonth = payments.filter((p) => {
      const direct =
        p.month === selectedMonth && Number(p.year) === Number(selectedYear);
      const advance =
        p.isAdvance &&
        Array.isArray(p.coveredMonths) &&
        p.coveredMonths.some(
          (cm) =>
            cm.month === selectedMonth &&
            Number(cm.year) === Number(selectedYear)
        );
      return direct || advance;
    });

    const collected = paidInMonth.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
    const rate =
      expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;

    return {
      expected,
      collected,
      rate,
      participatingCount: participating.length,
    };
  }, [residents, payments, settings?.monthlyCharge, selectedMonth, selectedYear]);

  const filteredGarbageResidents = useMemo(() => {
    return residents.filter((resident) => {
      const query = garbageSearch.toLowerCase();
      const matchesQuery =
        (resident.flat || "").toLowerCase().includes(query) ||
        (resident.flatNumber || "").toLowerCase().includes(query) ||
        (resident.plotNumber || "").toLowerCase().includes(query) ||
        (resident.owner || "").toLowerCase().includes(query) ||
        (resident.name || "").toLowerCase().includes(query) ||
        (resident.floor || "").toLowerCase().includes(query) ||
        (resident.block || "").toLowerCase().includes(query) ||
        (resident.mobile || resident.phone || "").includes(query);
      if (!matchesQuery) return false;

      const participating = isGcParticipating(resident) && !isPriorToResidentBillingStart(resident, selectedMonth, selectedYear);
      const paid = isGarbagePaid(resident);

      if (garbageFilter === "not_participating") return !participating;
      if (garbageFilter === "paid") return participating && paid;
      if (garbageFilter === "pending") return participating && !paid;
      return true;
    });
  }, [
    residents,
    garbageSearch,
    garbageFilter,
    payments,
    bills,
    selectedMonth,
    selectedYear,
  ]);

  async function handleGarbageCollect(paymentData) {
    const success = await collectResidentPayment({
      resident: selectedResident,
      month: selectedMonth,
      year: selectedYear,
      paymentData,
      bills,
      addPayment,
      collector: user?.name || "Collector",
      collectorId: user?.uid,
    });

    if (success) {
      setOpenGarbageModal(false);
      setSelectedResident(null);
      setSuccessReceipt(success);
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

  // Subscribe to Special Collections & Payments
  useEffect(() => {
    const unsubCol = subscribeSpecialCollections((list) => {
      // Filter active campaigns authorized for this collector
      let activeList = list.filter((c) => c.status === "active");
      if (Array.isArray(user?.assignedCampaigns) && user.assignedCampaigns.length > 0) {
        activeList = activeList.filter((c) => user.assignedCampaigns.includes(c.id));
      }
      setSpecialCollections(activeList);
      if (activeList.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(activeList[0].id);
      }
    });

    const unsubPay = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list);
    });

    return () => {
      unsubCol();
      unsubPay();
    };
  }, [user?.assignedCampaigns, selectedCampaignId]);

  // Selected Campaign Object
  const currentCampaign = useMemo(() => {
    return specialCollections.find((c) => c.id === selectedCampaignId) || specialCollections[0] || null;
  }, [specialCollections, selectedCampaignId]);

  // Payments for current campaign
  const currentCampaignPayments = useMemo(() => {
    if (!currentCampaign) return [];
    return specialPayments.filter(
      (p) => p.collectionId === currentCampaign.id && p.status === "confirmed"
    );
  }, [specialPayments, currentCampaign?.id]);

  // Check if resident has contributed to current campaign
  function getResidentContribution(resident) {
    if (!currentCampaign) return null;
    return currentCampaignPayments.find(
      (p) =>
        (p.residentId && p.residentId === resident.id) ||
        (p.flatNumber && resident.flatNumber && p.flatNumber.toLowerCase() === resident.flatNumber.toLowerCase())
    );
  }

  // Filtered residents for Special Collections
  const filteredSpecialResidents = useMemo(() => {
    return residents
      .slice()
      .sort((a, b) => (a.flatNumber || "").localeCompare(b.flatNumber || ""))
      .filter((resident) => {
        const query = specialSearch.toLowerCase();
        const matchesQuery =
          (resident.flatNumber || "").toLowerCase().includes(query) ||
          (resident.flat || "").toLowerCase().includes(query) ||
          (resident.name || "").toLowerCase().includes(query) ||
          (resident.owner || "").toLowerCase().includes(query) ||
          (resident.floor || "").toLowerCase().includes(query) ||
          (resident.block || "").toLowerCase().includes(query) ||
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
          collectorName: user?.name || "Collector",
          remarks: collectFormData.remarks.trim(),
        },
        user
      );

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

  return (
    <>
      <div className="space-y-5">

        {/* ─── Top Header & Assigned Powers Switcher ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collector Portal</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Authorized collection terminal for {user?.name || "Collector"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            <PrinterQuickAction />

            {/* Module Switcher Tabs (When collector has both powers) */}
            {hasGarbage && hasSpecial && (
              <div className="flex bg-gray-200/80 p-1 rounded-2xl gap-1 shadow-inner">
                <button
                  onClick={() => setActiveModule("garbage")}
                  className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                    activeModule === "garbage"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <FaTrashAlt className="text-emerald-600" />
                  Garbage Collection
                </button>
                <button
                  onClick={() => setActiveModule("special_collections")}
                  className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                    activeModule === "special_collections"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <FaHandHoldingHeart className="text-indigo-600" />
                  Special Collections
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MODULE 1: GARBAGE COLLECTION                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeModule === "garbage" && hasGarbage && (
          <div className="space-y-4">
            {/* Synchronized Month & Year Selection Bar */}
            <CollectorMonthBar
              title={`Monthly Cycle: ${selectedMonth} ${selectedYear}`}
              subtitle="Select month to filter records, view pending/paid status & collect"
            />

            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  <FaTrashAlt /> Garbage Collection Module
                </span>
                <h2 className="text-xl font-bold mt-0.5">
                  Billing Period: {selectedMonth} {selectedYear}
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  {garbageCounts.paid} of {monthlyFinancials.participatingCount} participating residents paid ({monthlyFinancials.rate}%)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAddResident(true)}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <FaUserPlus /> Add Resident
                </button>
              </div>
            </div>

            {/* Quick Monthly Progress Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs">
                <span className="text-[11px] text-gray-500 font-semibold block">Pending Residents</span>
                <span className="text-lg font-bold text-red-600">{garbageCounts.pending}</span>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs">
                <span className="text-[11px] text-gray-500 font-semibold block">Paid Residents</span>
                <span className="text-lg font-bold text-emerald-600">{garbageCounts.paid}</span>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs">
                <span className="text-[11px] text-gray-500 font-semibold block">Collected for {selectedMonth}</span>
                <span className="text-lg font-bold text-emerald-700">₹{monthlyFinancials.collected.toLocaleString("en-IN")}</span>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-xs">
                <span className="text-[11px] text-gray-500 font-semibold block">Progress Rate</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold text-gray-800">{monthlyFinancials.rate}%</span>
                  <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${monthlyFinancials.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Garbage Search & Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="relative">
                <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
                <input
                  value={garbageSearch}
                  onChange={(e) => setGarbageSearch(e.target.value)}
                  placeholder="Search by flat, resident, or mobile number..."
                  className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setGarbageFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All ({garbageCounts.all})
                </button>
                <button
                  onClick={() => setGarbageFilter("pending")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "pending"
                      ? "bg-red-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Pending ({garbageCounts.pending})
                </button>
                <button
                  onClick={() => setGarbageFilter("paid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "paid"
                      ? "bg-green-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Paid ({garbageCounts.paid})
                </button>
                <button
                  onClick={() => setGarbageFilter("not_participating")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    garbageFilter === "not_participating"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Not Participating ({garbageCounts.notParticipating})
                </button>
              </div>
            </div>

            {/* Garbage Residents List */}
            <div className="space-y-2.5">
              {filteredGarbageResidents.map((resident) => {
                const participating = isGcParticipating(resident);
                const paid = isGarbagePaid(resident.id);
                const resGarbagePayments = getResidentGarbagePayments(resident);

                return (
                  <div
                    key={resident.id}
                    className={`rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition ${
                      !participating
                        ? "bg-gray-50/70 border-gray-200"
                        : "bg-white border-gray-100 hover:border-emerald-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-base">
                          Flat {resident.flat || resident.flatNumber || "—"}
                        </span>
                        {resident.block && (
                          <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {resident.block}
                          </span>
                        )}
                        {resident.plotNumber && resident.plotNumber !== (resident.flat || resident.flatNumber) && (
                          <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-2 py-0.5 rounded">
                            Plot {resident.plotNumber}
                          </span>
                        )}
                        {formatResidentFloor(resident.floor) && (
                          <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 rounded">
                            {formatResidentFloor(resident.floor)}
                          </span>
                        )}
                        {resident.unitNumber && (
                          <span className="text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/70 px-2 py-0.5 rounded">
                            Unit {resident.unitNumber}
                          </span>
                        )}
                        {resident.personType && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              String(resident.personType).toUpperCase() === "TENANT" || String(resident.personType).toUpperCase() === "RENTED"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {String(resident.personType).toUpperCase() === "TENANT" ? "RENTED" : resident.personType}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {resident.name || resident.owner || "Resident"}
                        {(resident.mobile || resident.phone) ? ` • ${resident.mobile || resident.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                      {!participating ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 border border-gray-300">
                          Not Participating
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            paid
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {paid ? "Paid" : "Pending"}
                        </span>
                      )}

                      {!participating ? (
                        <>
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2 rounded-xl text-gray-400 bg-gray-100 flex items-center gap-1.5 text-xs font-bold cursor-not-allowed border border-gray-200 select-none opacity-80"
                            title="Resident is not enrolled in garbage collection"
                          >
                            <FaMoneyBillWave className="text-gray-400" />
                            Collect
                          </button>

                          {resGarbagePayments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setReceiptsModalResident(resident)}
                              className="px-2.5 py-2 rounded-xl bg-gray-100 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 transition text-xs cursor-pointer flex items-center gap-1"
                              title={`View ${resGarbagePayments.length} Past Receipts`}
                            >
                              <FaReceipt className="text-[10px]" />
                              <span className="text-[11px] font-semibold">Receipts ({resGarbagePayments.length})</span>
                            </button>
                          )}
                        </>
                      ) : paid ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintGarbageReceipt(resident)}
                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                            title="Print Official Payment Receipt"
                          >
                            <FaPrint className="text-xs" />
                            Print Receipt
                          </button>

                          {resGarbagePayments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setReceiptsModalResident(resident)}
                              className="p-2.5 rounded-xl bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 transition text-xs cursor-pointer"
                              title={`View All Receipts (${resGarbagePayments.length})`}
                            >
                              <FaReceipt />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setSelectedResident(resident);
                              setOpenGarbageModal(true);
                            }}
                            className="px-4 py-2 rounded-xl text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95"
                          >
                            <FaMoneyBillWave />
                            Collect
                          </button>

                          {resGarbagePayments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setReceiptsModalResident(resident)}
                              className="px-2.5 py-2 rounded-xl bg-gray-100 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 transition text-xs cursor-pointer flex items-center gap-1"
                              title={`View ${resGarbagePayments.length} Past Receipts`}
                            >
                              <FaReceipt className="text-[10px]" />
                              <span className="text-[11px] font-semibold">Receipts ({resGarbagePayments.length})</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredGarbageResidents.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500 text-sm">
                  No garbage collection residents found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MODULE 2: SPECIAL COLLECTIONS & CONTRIBUTIONS                */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeModule === "special_collections" && hasSpecial && (
          <div className="space-y-4">
            {/* Campaign Selection & Overview */}
            {specialCollections.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl mx-auto">
                  <FaHandHoldingHeart />
                </div>
                <h3 className="font-bold text-gray-800 text-base">No Active Special Collections</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  There are currently no active special collection campaigns assigned to your account. When the Admin activates a campaign, it will appear here for collection.
                </p>
              </div>
            ) : (
              <>
                {/* Active Campaign Selector / Banner */}
                <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-2xl p-5 text-white shadow-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                        <FaHandHoldingHeart /> Special Collection Campaign
                      </span>
                      <h2 className="text-xl font-bold mt-0.5">{currentCampaign?.name}</h2>
                      <p className="text-xs text-indigo-100 mt-0.5">{currentCampaign?.purpose}</p>
                    </div>

                    {/* Campaign Switcher Dropdown if multiple */}
                    {specialCollections.length > 1 && (
                      <div className="bg-white/10 p-1.5 rounded-xl backdrop-blur-sm">
                        <select
                          value={selectedCampaignId}
                          onChange={(e) => setSelectedCampaignId(e.target.value)}
                          className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
                        >
                          {specialCollections.map((col) => (
                            <option key={col.id} value={col.id} className="text-gray-900">
                              {col.name} ({col.collectionType})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Campaign Progress Bar & Metrics */}
                  <div className="pt-2 border-t border-indigo-500/50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-indigo-200 block text-[11px]">Requirement</span>
                      <span className="font-bold text-sm">
                        {currentCampaign?.amountType === "fixed"
                          ? `₹${currentCampaign?.fixedAmount} Fixed`
                          : "Flexible Contribution"}
                      </span>
                    </div>

                    <div>
                      <span className="text-indigo-200 block text-[11px]">Collected So Far</span>
                      <span className="font-bold text-sm text-emerald-300">
                        ₹
                        {currentCampaignPayments
                          .reduce((s, p) => s + Number(p.amount || 0), 0)
                          .toLocaleString("en-IN")}{" "}
                        ({currentCampaignPayments.length} contributions)
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-indigo-200 block text-[11px]">Target Amount</span>
                      <span className="font-bold text-sm">
                        {currentCampaign?.targetAmount
                          ? `₹${Number(currentCampaign.targetAmount).toLocaleString("en-IN")}`
                          : "Open-ended"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions & Filters */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
                      <input
                        value={specialSearch}
                        onChange={(e) => setSpecialSearch(e.target.value)}
                        placeholder="Search by flat, resident, or mobile number..."
                        className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Quick Button for Guest / External Contributor */}
                    <button
                      onClick={handleOpenExternalCollect}
                      className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0"
                    >
                      <FaUserPlus /> + External / Guest
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSpecialFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        specialFilter === "all"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      All Residents ({residents.length})
                    </button>
                    <button
                      onClick={() => setSpecialFilter("pending")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        specialFilter === "pending"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => setSpecialFilter("contributed")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        specialFilter === "contributed"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                    const resSpecialPayments = getResidentSpecialPayments(resident);
                    const resGarbagePayments = getResidentGarbagePayments(resident);
                    const hasAnyReceipts = resSpecialPayments.length > 0 || resGarbagePayments.length > 0;

                    return (
                      <div
                        key={resident.id}
                        className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 hover:border-indigo-200 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-base">
                              Flat {resident.flatNumber || resident.flat || "—"}
                            </span>
                            {resident.block && (
                              <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                {resident.block}
                              </span>
                            )}
                            {formatResidentFloor(resident.floor) && (
                              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 rounded">
                                {formatResidentFloor(resident.floor)}
                              </span>
                            )}
                            {resident.personType && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  String(resident.personType).toUpperCase() === "TENANT" || String(resident.personType).toUpperCase() === "RENTED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {String(resident.personType).toUpperCase() === "TENANT" ? "RENTED" : resident.personType}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {resident.name || resident.owner || "Resident"}
                            {(resident.mobileNumber || resident.mobile || resident.phone) ? ` • ${resident.mobileNumber || resident.mobile || resident.phone}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                          {contribution ? (
                            <>
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-xs">
                                <FaCheckCircle className="text-emerald-600 text-[10px]" />
                                Contributed ₹{contribution.amount}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  printPaymentReceipt({
                                    ...contribution,
                                    collectionName: currentCampaign?.name || "Special Collection",
                                    purpose: currentCampaign?.purpose || "Special Contribution",
                                    contributorType: "Resident",
                                    residentName: resident.name || resident.owner || contribution.contributorName || "Resident",
                                    flat: resident.flatNumber || resident.flat || contribution.flatNumber || "—",
                                    plotNumber: resident.plotNumber || contribution.plotNumber || resident.flat || "",
                                    floor: resident.floor || contribution.floor || "",
                                    unitNumber: resident.unitNumber || contribution.unitNumber || "",
                                    personType: resident.personType || contribution.personType || "",
                                    block: resident.block || contribution.block || "",
                                  })
                                }
                                title="Print Official Payment Receipt"
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                              >
                                <FaPrint className="text-xs" />
                                Print Receipt
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  generateSpecialCollectionReceipt({
                                    ...contribution,
                                    collectionName: currentCampaign?.name,
                                    purpose: currentCampaign?.purpose,
                                    contributorType: "Resident",
                                    residentName: resident.name || resident.owner || contribution.contributorName || "Resident",
                                    flat: resident.flatNumber || resident.flat || contribution.flatNumber || "—",
                                    flatNumber: resident.flatNumber || resident.flat || contribution.flatNumber || "—",
                                    plotNumber: resident.plotNumber || contribution.plotNumber || resident.flat || "",
                                    floor: resident.floor || contribution.floor || "",
                                    unitNumber: resident.unitNumber || contribution.unitNumber || "",
                                    personType: resident.personType || contribution.personType || "",
                                    block: resident.block || contribution.block || "",
                                  })
                                }
                                title="Download PDF Receipt"
                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs transition cursor-pointer"
                              >
                                <FaFileDownload />
                              </button>

                              {hasAnyReceipts && (
                                <button
                                  type="button"
                                  onClick={() => setReceiptsModalResident(resident)}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 transition text-xs cursor-pointer"
                                  title="View All Resident Receipts"
                                >
                                  <FaReceipt />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenSpecialCollect(resident)}
                                className="px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                              >
                                <FaMoneyBillWave />
                                Collect
                                {currentCampaign?.amountType === "fixed" ? ` ₹${currentCampaign?.fixedAmount}` : ""}
                              </button>

                              {hasAnyReceipts && (
                                <button
                                  type="button"
                                  onClick={() => setReceiptsModalResident(resident)}
                                  className="px-2.5 py-2 rounded-xl bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-indigo-700 transition text-xs cursor-pointer flex items-center gap-1"
                                  title="Past Receipts"
                                >
                                  <FaReceipt className="text-[10px]" />
                                  <span className="text-[11px] font-semibold">Receipts ({resSpecialPayments.length + resGarbagePayments.length})</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredSpecialResidents.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500 text-sm">
                      No residents found matching your criteria.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ─── 3. GARBAGE PAYMENT MODAL ─── */}
      <PaymentModal
        open={openGarbageModal}
        resident={selectedResident}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => {
          setOpenGarbageModal(false);
          setSelectedResident(null);
        }}
        onCollect={handleGarbageCollect}
      />

      {/* ─── 4. SPECIAL CONTRIBUTION COLLECT MODAL ─── */}
      {collectModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <FaHandHoldingHeart className="text-indigo-600" />
                Collect Special Contribution
              </h3>
              <button
                onClick={() => setCollectModalOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-xs text-indigo-900">
              <span className="font-bold block">{currentCampaign?.name}</span>
              <span className="text-[11px] text-indigo-700 block mt-0.5">
                {currentCampaign?.purpose} • {currentCampaign?.amountType === "fixed" ? `₹${currentCampaign.fixedAmount} Fixed` : "Flexible Amount"}
              </span>
            </div>

            <form onSubmit={handleSubmitSpecialCollect} className="space-y-3.5">
              {/* Contributor Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Contributor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={collectFormData.contributorName}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({ ...prev, contributorName: e.target.value }))
                  }
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Flat & Block */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Flat / Unit</label>
                  <input
                    type="text"
                    value={collectFormData.flatNumber}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({ ...prev, flatNumber: e.target.value }))
                    }
                    placeholder="e.g. D-101"
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Block / Section</label>
                  <input
                    type="text"
                    value={collectFormData.block}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({ ...prev, block: e.target.value }))
                    }
                    placeholder="e.g. D-Block"
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={collectFormData.mobileNumber}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({ ...prev, mobileNumber: e.target.value }))
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Amount & Mode */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={collectFormData.amount}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={collectFormData.paymentMethod}
                    onChange={(e) =>
                      setCollectFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Offline UPI">Offline UPI</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={collectFormData.remarks}
                  onChange={(e) =>
                    setCollectFormData((prev) => ({ ...prev, remarks: e.target.value }))
                  }
                  placeholder="e.g. Handed cash at flat door"
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
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

      {/* ─── 6. ALL RESIDENT RECEIPTS HISTORY MODAL ─── */}
      <ResidentReceiptsListModal
        open={Boolean(receiptsModalResident)}
        resident={receiptsModalResident}
        garbagePayments={receiptsModalResident ? getResidentGarbagePayments(receiptsModalResident) : []}
        specialPayments={receiptsModalResident ? getResidentSpecialPayments(receiptsModalResident) : []}
        onClose={() => setReceiptsModalResident(null)}
      />
      {/* Add Resident Drawer */}
      {showAddResident && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <FaUserPlus className="text-xl" />
                <h2 className="text-xl font-bold">Add New Resident</h2>
              </div>
              <button onClick={() => setShowAddResident(false)} className="text-xl hover:text-red-300">
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
                defaultMonth={selectedMonth}
                defaultYear={selectedYear}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}