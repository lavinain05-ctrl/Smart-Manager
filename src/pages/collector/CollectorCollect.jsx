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

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";

import { collectResidentPayment } from "../../utils/collectPayment";
import { isGcParticipating } from "../../services/statisticsService";
import {
  subscribeSpecialCollections,
  subscribeAllSpecialPayments,
  recordOfflineSpecialCollectionPayment,
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";

export default function CollectorCollect() {
  const { user } = useAuth();
  const { residents, addResident } = useResidents();
  const { payments, addPayment } = usePayments();
  const { bills } = useBills();
  const { settings } = useSettings();

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

  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  function isGarbagePaid(residentId) {
    return payments.some(
      (payment) =>
        payment.residentId === residentId &&
        ((payment.month === currentMonth && Number(payment.year) === Number(currentYear)) ||
         (payment.isAdvance && Array.isArray(payment.coveredMonths) &&
          payment.coveredMonths.some((cm) => cm.month === currentMonth && Number(cm.year) === Number(currentYear))))
    );
  }

  // Resident Receipts Modal State
  const [receiptsModalResident, setReceiptsModalResident] = useState(null);

  function getResidentGarbagePayments(resident) {
    if (!resident) return [];
    return payments.filter(
      (p) =>
        (resident.id && p.residentId === resident.id) ||
        (resident.flat && p.flat && String(p.flat).toLowerCase() === String(resident.flat).toLowerCase()) ||
        (resident.flatNumber && p.flat && String(p.flat).toLowerCase() === String(resident.flatNumber).toLowerCase())
    );
  }

  function getResidentCurrentPayment(resident) {
    const list = getResidentGarbagePayments(resident);
    return list.find(
      (p) =>
        (p.month === currentMonth && Number(p.year) === Number(currentYear)) ||
        (p.isAdvance && Array.isArray(p.coveredMonths) &&
         p.coveredMonths.some((cm) => cm.month === currentMonth && Number(cm.year) === Number(currentYear)))
    ) || list[0];
  }

  function getResidentSpecialPayments(resident) {
    if (!resident) return [];
    return specialPayments.filter(
      (p) =>
        p.status === "confirmed" &&
        ((resident.id && p.residentId === resident.id) ||
         (resident.flatNumber && p.flatNumber && String(p.flatNumber).toLowerCase() === String(resident.flatNumber).toLowerCase()) ||
         (resident.flat && p.flatNumber && String(p.flatNumber).toLowerCase() === String(resident.flat).toLowerCase()))
    );
  }

  function handlePrintGarbageReceipt(resident) {
    const payment = getResidentCurrentPayment(resident);
    if (payment) {
      printPaymentReceipt({
        ...payment,
        residentName: resident.name || resident.owner || payment.residentName || "Resident",
        flat: resident.flat || resident.flatNumber || payment.flat || "—",
        block: resident.block || payment.block || "",
      });
      toast.success(`Printing receipt for Flat ${resident.flat || resident.flatNumber || "—"}...`);
    } else {
      toast.error("No receipt found for this resident.");
    }
  }

  async function handleAddResident(formData) {
    const result = await addResident({
      ...formData,
      status: "Active",
      garbageStatus: "participating",
      collectorId: user?.uid || "",
      collectorName: user?.name || user?.email || "Collector",
      createdBy: "Collector",
      createdById: user?.uid,
      createdByName: user?.name || user?.email,
      charge: Number(formData.charge) || Number(settings?.monthlyCharge) || 80,
      createdAt: new Date().toISOString(),
    });

    if (result) {
      setShowAddResident(false);
      toast.success("Resident added! Ready for collection.");
    }
  }

  const filteredGarbageResidents = useMemo(() => {
    return residents
      .filter((resident) => isGcParticipating(resident))
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
    const success = await collectResidentPayment({
      resident: selectedResident,
      month: currentMonth,
      year: currentYear,
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
  }, [specialPayments, currentCampaign]);

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

          {/* Module Switcher Tabs (When collector has both powers) */}
          {hasGarbage && hasSpecial && (
            <div className="flex bg-gray-200/80 p-1 rounded-2xl gap-1 shadow-inner self-start sm:self-auto">
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* MODULE 1: GARBAGE COLLECTION                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeModule === "garbage" && hasGarbage && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                  <FaTrashAlt /> Garbage Collection Module
                </span>
                <h2 className="text-lg font-bold mt-0.5">
                  Monthly Billing: {currentMonth} {currentYear}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddResident(true)}
                  className="bg-white text-emerald-800 hover:bg-emerald-50 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <FaUserPlus /> Add Resident
                </button>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm hidden sm:inline-block">
                  Active Cycle
                </span>
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
              <div className="flex gap-2">
                <button
                  onClick={() => setGarbageFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    garbageFilter === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All ({residents.filter((r) => isGcParticipating(r)).length})
                </button>
                <button
                  onClick={() => setGarbageFilter("pending")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    garbageFilter === "pending"
                      ? "bg-red-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setGarbageFilter("paid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    garbageFilter === "paid"
                      ? "bg-green-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                const resGarbagePayments = getResidentGarbagePayments(resident);

                return (
                  <div
                    key={resident.id}
                    className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 hover:border-emerald-200 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-base">
                          Flat {resident.flat || resident.flatNumber || "—"}
                        </span>
                        {resident.block && (
                          <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                            {resident.block}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {resident.name || resident.owner || "Resident"}
                        {resident.phone ? ` • ${resident.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          paid
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {paid ? "Paid" : "Pending"}
                      </span>

                      {paid ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintGarbageReceipt(resident)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-base">
                              Flat {resident.flatNumber || resident.flat || "—"}
                            </span>
                            {resident.block && (
                              <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                {resident.block}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {resident.name || resident.owner || "Resident"}
                            {(resident.mobileNumber || resident.mobile) ? ` • ${resident.mobileNumber || resident.mobile}` : ""}
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
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}