import { useState, useEffect, useMemo } from "react";
import {
  FaHandHoldingHeart,
  FaPlus,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaShareAlt,
  FaReceipt,
  FaMoneyBillWave,
  FaBuilding,
  FaCalendarAlt,
  FaEdit,
  FaTrash,
  FaBan,
  FaArchive,
  FaCopy,
  FaExternalLinkAlt,
  FaWhatsapp,
  FaEye,
  FaFileDownload,
  FaUndo,
  FaInfoCircle,
  FaTimes,
  FaPhone,
  FaUser,
  FaGlobe,
  FaLink,
  FaMotorcycle,
  FaUserShield,
  FaQrcode,
  FaPrint,
} from "react-icons/fa";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { useCollectors } from "../../context/CollectorContext";
import {
  subscribeSpecialCollections,
  createSpecialCollection,
  updateSpecialCollection,
  closeSpecialCollection,
  archiveSpecialCollection,
  subscribeAllSpecialPayments,
  confirmSpecialCollectionPayment,
  rejectSpecialCollectionPayment,
  refundSpecialCollectionPayment,
  recordOfflineSpecialCollectionPayment,
  COLLECTION_TYPES,
  CONTRIBUTION_TYPES,
  TARGET_AUDIENCES,
  REJECTION_REASONS,
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";

/**
 * Identify source channel, collector, and payment mode for any special collection payment
 */
export function getPaymentChannelMeta(payment) {
  if (!payment) {
    return {
      channel: "resident_portal",
      channelName: "Resident Portal (Online)",
      collectorName: null,
      mode: "online",
      modeLabel: "Online",
      contributorCategory: "resident",
      isCash: false,
      isCollector: false,
      isAdminOffline: false,
      isSharedLink: false,
      isResidentPortal: true,
    };
  }

  // 1. Is it collected by a field collector?
  const hasCollector =
    Boolean(payment.collectorId && payment.collectorId !== "admin") ||
    Boolean(
      payment.collectorName &&
      payment.collectorName !== "Admin" &&
      payment.collectorName !== "RWA Admin / Office" &&
      !payment.collectorName.toLowerCase().includes("admin")
    );

  // 2. Is it offline/cash recorded by admin?
  const isOffline =
    payment.referenceNumber?.startsWith("OFFLINE-") ||
    payment.paymentMethod?.toLowerCase() === "cash" ||
    payment.utr === "CASH-OFFLINE";

  // 3. Is it external guest / shared link?
  const isSharedLink =
    payment.contributorType === "external" ||
    payment.referenceNumber?.startsWith("EXT-SC-");

  // Determine channel key & label
  let channel;
  let channelName;
  let collectorName = null;

  if (hasCollector) {
    channel = "collector";
    collectorName = payment.collectorName || "Collector";
    channelName = `Collector (${collectorName})`;
  } else if (isOffline) {
    channel = "admin_office";
    channelName = "Admin Office (Direct)";
  } else if (isSharedLink) {
    channel = "shared_link";
    channelName = "Shared Form Link (Public)";
  } else {
    channel = "resident_portal";
    channelName = "Resident Portal (Online)";
  }

  // Determine payment mode (Cash vs UPI/Online vs Cheque)
  const isCash =
    payment.paymentMethod?.toLowerCase() === "cash" ||
    payment.utr === "CASH-OFFLINE";

  const isCheque =
    payment.paymentMethod?.toLowerCase() === "cheque" ||
    payment.paymentMethod?.toLowerCase() === "bank transfer";

  const mode = isCash ? "cash" : isCheque ? "cheque" : "online";
  const modeLabel = isCash
    ? "Cash"
    : isCheque
    ? "Cheque / Bank"
    : (payment.paymentMethod || "UPI / Online");

  const contributorCategory =
    isSharedLink || payment.contributorType === "external" ? "external" : "resident";

  return {
    channel, // "resident_portal" | "shared_link" | "admin_office" | "collector"
    channelName,
    collectorName,
    mode, // "cash" | "online" | "cheque"
    modeLabel,
    contributorCategory, // "resident" | "external"
    isCash,
    isCollector: hasCollector,
    isAdminOffline: isOffline && !hasCollector,
    isSharedLink,
    isResidentPortal: channel === "resident_portal",
  };
}

export default function SpecialCollections() {
  const { user } = useAuth();
  const { residents = [] } = useResidents() || {};
  const { collectors = [] } = useCollectors() || {};

  // Collections & Payments State
  const [collections, setCollections] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [selectedCampaignForPayments, setSelectedCampaignForPayments] = useState(null);
  const [sharingCampaign, setSharingCampaign] = useState(null);

  // Cash / Offline Contribution State
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashReceiptModal, setCashReceiptModal] = useState(null);
  const initialCashForm = {
    collectionId: "",
    contributorType: "resident",
    residentId: "",
    contributorName: "",
    flatNumber: "",
    block: "",
    mobileNumber: "",
    amount: "",
    paymentMethod: "Cash",
    paymentDate: new Date().toISOString().split("T")[0],
    collectorId: "admin",
    collectorName: "RWA Admin / Office",
    remarks: "",
  };
  const [cashFormData, setCashFormData] = useState(initialCashForm);

  // Payment Verification Dialogs
  const [confirmingPayment, setConfirmingPayment] = useState(null);
  const [rejectingPayment, setRejectingPayment] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [refundingPayment, setRefundingPayment] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const initialForm = {
    name: "",
    purpose: "",
    description: "",
    collectionType: "Festival",
    amountType: "fixed",
    fixedAmount: "",
    minimumAmount: "",
    maximumAmount: "",
    targetAmount: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    targetAudience: "all_residents",
    publicEnabled: false,
    upiId: "",
    upiName: "D Block RWA Indraprastha",
    bankName: "",
    accountName: "D Block RWA Indraprastha",
    accountNumber: "",
    ifsc: "",
    branch: "",
  };
  const [formData, setFormData] = useState(initialForm);

  // Payment drawer filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentChannelFilter, setPaymentChannelFilter] = useState("all"); // all, resident_portal, shared_link, admin_office, collector
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all"); // all, cash, online
  const [paymentCollectorFilter, setPaymentCollectorFilter] = useState("all"); // all or specific collector
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState("all"); // all, resident, external
  const [paymentSearch, setPaymentSearch] = useState("");

  function resetPaymentFilters() {
    setPaymentStatusFilter("all");
    setPaymentChannelFilter("all");
    setPaymentMethodFilter("all");
    setPaymentCollectorFilter("all");
    setPaymentCategoryFilter("all");
    setPaymentSearch("");
  }

  // 1. Subscribe to Collections & Payments
  useEffect(() => {
    const unsubCol = subscribeSpecialCollections((list) => {
      setCollections(list);
      setLoading(false);
    });

    const unsubPay = subscribeAllSpecialPayments((list) => {
      setPayments(list);
    });

    return () => {
      unsubCol();
      unsubPay();
    };
  }, []);

  // 2. Global Statistics
  const stats = useMemo(() => {
    const totalCampaigns = collections.length;
    const activeCampaigns = collections.filter((c) => c.status === "active").length;

    // Payments calculations - strictly isolated
    const confirmedPayments = payments.filter((p) => p.status === "confirmed");
    const pendingPayments = payments.filter((p) => p.status === "pending");
    const rejectedPayments = payments.filter((p) => p.status === "rejected");
    const refundedPayments = payments.filter((p) => p.status === "refunded");

    const totalConfirmedAmount = confirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalRefundedAmount = refundedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const netCollected = totalConfirmedAmount - totalRefundedAmount;

    return {
      totalCampaigns,
      activeCampaigns,
      pendingCount: pendingPayments.length,
      pendingAmount: totalPendingAmount,
      confirmedCount: confirmedPayments.length,
      confirmedAmount: totalConfirmedAmount,
      rejectedCount: rejectedPayments.length,
      refundedAmount: totalRefundedAmount,
      netCollected,
    };
  }, [collections, payments]);

  // 3. Filtered Collections
  const filteredCollections = useMemo(() => {
    return collections.filter((col) => {
      const matchesStatus = statusFilter === "all" || col.status === statusFilter;
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        (col.name || "").toLowerCase().includes(term) ||
        (col.purpose || "").toLowerCase().includes(term) ||
        (col.collectionType || "").toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [collections, statusFilter, search]);

  // 4. Breakdown Counts for Selected Campaign
  const campaignCounts = useMemo(() => {
    if (!selectedCampaignForPayments) {
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
        refunded: 0,
        channels: { resident_portal: 0, shared_link: 0, admin_office: 0, collector: 0 },
        modes: { cash: 0, online: 0 },
        categories: { resident: 0, external: 0 },
        collectors: {},
      };
    }

    const list = payments.filter((p) => p.collectionId === selectedCampaignForPayments.id);
    const counts = {
      total: list.length,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      refunded: 0,
      channels: { resident_portal: 0, shared_link: 0, admin_office: 0, collector: 0 },
      modes: { cash: 0, online: 0 },
      categories: { resident: 0, external: 0 },
      collectors: {},
    };

    list.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status]++;

      const meta = getPaymentChannelMeta(p);
      if (counts.channels[meta.channel] !== undefined) {
        counts.channels[meta.channel]++;
      }
      if (counts.modes[meta.mode] !== undefined) {
        counts.modes[meta.mode]++;
      }
      if (counts.categories[meta.contributorCategory] !== undefined) {
        counts.categories[meta.contributorCategory]++;
      }
      if (meta.collectorName) {
        counts.collectors[meta.collectorName] = (counts.collectors[meta.collectorName] || 0) + 1;
      }
    });

    return counts;
  }, [payments, selectedCampaignForPayments]);

  // 5. Filtered Payments for Selected Campaign
  const campaignPayments = useMemo(() => {
    if (!selectedCampaignForPayments) return [];
    let list = payments.filter((p) => p.collectionId === selectedCampaignForPayments.id);

    // 1. Status Filter
    if (paymentStatusFilter !== "all") {
      list = list.filter((p) => p.status === paymentStatusFilter);
    }

    // 2. Channel Filter (Resident Portal, Shared Link, Admin Office, Collectors)
    if (paymentChannelFilter !== "all") {
      list = list.filter((p) => {
        const meta = getPaymentChannelMeta(p);
        return meta.channel === paymentChannelFilter;
      });
    }

    // 3. Payment Mode Filter (Cash vs Online/UPI)
    if (paymentMethodFilter !== "all") {
      list = list.filter((p) => {
        const meta = getPaymentChannelMeta(p);
        return meta.mode === paymentMethodFilter;
      });
    }

    // 4. Specific Collector Filter
    if (paymentCollectorFilter !== "all") {
      list = list.filter((p) => {
        const meta = getPaymentChannelMeta(p);
        return (
          meta.collectorName === paymentCollectorFilter ||
          p.collectorId === paymentCollectorFilter
        );
      });
    }

    // 5. Contributor Category Filter (Resident vs External)
    if (paymentCategoryFilter !== "all") {
      list = list.filter((p) => {
        const meta = getPaymentChannelMeta(p);
        return meta.contributorCategory === paymentCategoryFilter;
      });
    }

    // 6. Search Term Filter
    if (paymentSearch.trim()) {
      const term = paymentSearch.toLowerCase();
      list = list.filter((p) => {
        const meta = getPaymentChannelMeta(p);
        return (
          (p.contributorName || "").toLowerCase().includes(term) ||
          (p.utr || "").toLowerCase().includes(term) ||
          (p.mobileNumber || "").includes(term) ||
          (p.flatNumber || "").toLowerCase().includes(term) ||
          (p.referenceNumber || "").toLowerCase().includes(term) ||
          (meta.collectorName || "").toLowerCase().includes(term) ||
          (meta.channelName || "").toLowerCase().includes(term)
        );
      });
    }

    return list;
  }, [
    payments,
    selectedCampaignForPayments,
    paymentStatusFilter,
    paymentChannelFilter,
    paymentMethodFilter,
    paymentCollectorFilter,
    paymentCategoryFilter,
    paymentSearch,
  ]);

  // 6. Filtered Totals for View
  const filteredStats = useMemo(() => {
    const count = campaignPayments.length;
    const totalAmount = campaignPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const cashAmount = campaignPayments
      .filter((p) => getPaymentChannelMeta(p).isCash)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const onlineAmount = totalAmount - cashAmount;
    return { count, totalAmount, cashAmount, onlineAmount };
  }, [campaignPayments]);

  // 7. CSV Export for Campaign Payments
  function handleExportCampaignPaymentsCSV() {
    if (!campaignPayments || campaignPayments.length === 0) {
      toast.error("No payments to export.");
      return;
    }

    const headers = [
      "Receipt No",
      "Campaign",
      "Contributor Name",
      "Category",
      "Flat / Address",
      "Mobile",
      "Amount (INR)",
      "Payment Mode",
      "Channel / Source",
      "Collector / Officer",
      "UTR / Reference",
      "Payment Date",
      "Status",
      "Rejection / Notes",
    ];

    const rows = campaignPayments.map((p) => {
      const meta = getPaymentChannelMeta(p);
      return [
        `"${p.receiptNumber || ""}"`,
        `"${(selectedCampaignForPayments?.name || "").replace(/"/g, '""')}"`,
        `"${(p.contributorName || "").replace(/"/g, '""')}"`,
        `"${meta.contributorCategory === "external" ? "External Guest" : "Resident"}"`,
        `"${(p.flatNumber || "").replace(/"/g, '""')}"`,
        `"${p.mobileNumber || ""}"`,
        p.amount || 0,
        `"${meta.modeLabel}"`,
        `"${meta.channelName}"`,
        `"${meta.collectorName || (meta.isAdminOffline ? "Admin Office" : "")}"`,
        `"${p.utr || p.referenceNumber || ""}"`,
        `"${p.paymentDate || ""} ${p.paymentTime || ""}"`,
        `"${p.status}"`,
        `"${(p.rejectionReason || p.adminRemarks || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${(selectedCampaignForPayments?.name || "special_collection")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")}_payments_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${campaignPayments.length} payment records!`);
  }

  // ─── Cash / Offline Payment Handlers ───

  function handleOpenCashModal(campaignId = null) {
    const activeCols = collections.filter((c) => c.status === "active");
    const targetCol = campaignId
      ? activeCols.find((c) => c.id === campaignId)
      : activeCols[0];

    setCashFormData({
      ...initialCashForm,
      collectionId: targetCol ? targetCol.id : (activeCols[0]?.id || ""),
      amount: targetCol && targetCol.amountType === "fixed" ? targetCol.fixedAmount : "",
    });
    setShowCashModal(true);
  }

  function handleCashCampaignChange(selectedId) {
    const col = collections.find((c) => c.id === selectedId);
    setCashFormData((prev) => ({
      ...prev,
      collectionId: selectedId,
      amount: col && col.amountType === "fixed" ? col.fixedAmount : prev.amount,
    }));
  }

  function handleCashResidentChange(residentId) {
    if (!residentId) {
      setCashFormData((prev) => ({
        ...prev,
        residentId: "",
        contributorName: "",
        flatNumber: "",
        block: "",
        mobileNumber: "",
      }));
      return;
    }
    const res = residents.find((r) => r.id === residentId);
    if (res) {
      setCashFormData((prev) => ({
        ...prev,
        residentId: res.id,
        userId: res.userId || res.uid || res.id || "",
        contributorName: res.owner || res.name || "Resident",
        flatNumber: res.flat || res.flatNumber || "",
        block: res.block || "",
        mobileNumber: res.mobile || res.mobileNumber || res.phone || "",
      }));
    }
  }

  async function handleRecordCashSubmit(e) {
    e.preventDefault();
    if (!cashFormData.collectionId) {
      toast.error("Please select a collection campaign.");
      return;
    }
    if (!cashFormData.contributorName.trim()) {
      toast.error("Please provide contributor name.");
      return;
    }
    const numAmount = parseFloat(cashFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid contribution amount.");
      return;
    }

    try {
      setCashSubmitting(true);
      let colName = "RWA Admin / Office";
      if (cashFormData.collectorId && cashFormData.collectorId !== "admin") {
        const matchedCollector = collectors.find(
          (c) => c.id === cashFormData.collectorId || c.uid === cashFormData.collectorId
        );
        if (matchedCollector) colName = matchedCollector.name;
      }

      const receipt = await recordOfflineSpecialCollectionPayment(
        {
          ...cashFormData,
          collectorName: colName,
        },
        user
      );

      toast.success(`Cash payment recorded! Receipt ${receipt.receiptNumber} generated.`);
      setShowCashModal(false);
      setCashReceiptModal(receipt);
      setCashFormData(initialCashForm);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to record cash payment.");
    } finally {
      setCashSubmitting(false);
    }
  }

  // Open Create Modal
  function handleOpenCreate() {
    setEditingCollection(null);
    setFormData(initialForm);
    setShowCreateModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(col) {
    setEditingCollection(col);
    setFormData({
      name: col.name || "",
      purpose: col.purpose || "",
      description: col.description || "",
      collectionType: col.collectionType || "Festival",
      amountType: col.amountType || "fixed",
      fixedAmount: col.fixedAmount || "",
      minimumAmount: col.minimumAmount || "",
      maximumAmount: col.maximumAmount || "",
      targetAmount: col.targetAmount || "",
      startDate: col.startDate || "",
      endDate: col.endDate || "",
      targetAudience: col.targetAudience || "all_residents",
      publicEnabled: col.publicEnabled || false,
      upiId: col.upiId || "",
      upiName: col.upiName || "D Block RWA Indraprastha",
      bankName: col.bankName || "",
      accountName: col.accountName || "",
      accountNumber: col.accountNumber || "",
      ifsc: col.ifsc || "",
      branch: col.branch || "",
    });
    setShowCreateModal(true);
  }

  // Submit Campaign Form
  async function handleSaveCampaign(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.purpose.trim()) {
      toast.error("Please enter a collection name and purpose.");
      return;
    }
    if (!formData.upiId.trim() && !formData.accountNumber.trim()) {
      toast.error("Please provide at least a UPI ID or Bank Account details for receiving payments.");
      return;
    }

    try {
      setActionLoading(true);
      if (editingCollection) {
        await updateSpecialCollection(editingCollection.id, formData, user);
        toast.success("Special collection updated successfully!");
      } else {
        await createSpecialCollection(formData, user);
        toast.success("Special collection campaign created!");
      }
      setShowCreateModal(false);
      setFormData(initialForm);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save collection.");
    } finally {
      setActionLoading(false);
    }
  }

  // Close Collection Action
  async function handleCloseCampaign(col) {
    if (!window.confirm(`Are you sure you want to close "${col.name}"? New submissions will be disabled.`)) return;
    try {
      await closeSpecialCollection(col.id, user);
      toast.success("Collection closed to new contributions.");
    } catch (err) {
      toast.error(err.message || "Failed to close collection.");
    }
  }

  // Archive Collection Action
  async function handleArchiveCampaign(col) {
    if (!window.confirm(`Archive campaign "${col.name}"?`)) return;
    try {
      await archiveSpecialCollection(col.id, user);
      toast.success("Collection archived.");
    } catch (err) {
      toast.error(err.message || "Failed to archive collection.");
    }
  }

  // ─── Payment Verification Handlers ───

  async function handleConfirmPaymentSubmit() {
    if (!confirmingPayment) return;
    try {
      setActionLoading(true);
      const res = await confirmSpecialCollectionPayment(confirmingPayment, user);
      toast.success(`Payment confirmed! Receipt ${res.receiptNumber} generated.`);
      setConfirmingPayment(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to confirm payment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectPaymentSubmit() {
    if (!rejectingPayment) return;
    try {
      setActionLoading(true);
      await rejectSpecialCollectionPayment(
        rejectingPayment,
        rejectionReason,
        rejectionRemark,
        user
      );
      toast.success("Payment rejected.");
      setRejectingPayment(null);
      setRejectionRemark("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to reject payment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefundPaymentSubmit() {
    if (!refundingPayment) return;
    try {
      setActionLoading(true);
      await refundSpecialCollectionPayment(
        refundingPayment,
        refundReason,
        user
      );
      toast.success("Payment marked as refunded.");
      setRefundingPayment(null);
      setRefundReason("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to refund payment.");
    } finally {
      setActionLoading(false);
    }
  }

  // Copy helper
  function copyText(text, label = "Copied") {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
            <FaHandHoldingHeart className="text-emerald-600" />
            Special Collections & Contributions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Independent society campaigns for festivals, community events, and special funds.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => handleOpenCashModal()}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl font-semibold text-sm transition flex items-center gap-2 shadow-sm"
          >
            <FaMoneyBillWave className="text-emerald-600" /> Record Cash / Offline
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition flex items-center gap-2 shadow-sm"
          >
            <FaPlus /> Create Special Collection
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 block">Total Campaigns</span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{stats.totalCampaigns}</span>
          <span className="text-[11px] text-emerald-600 font-medium">{stats.activeCampaigns} Active</span>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-amber-600 font-medium block">Pending Verification</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            ₹{stats.pendingAmount.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-gray-500">{stats.pendingCount} Submissions</span>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-emerald-700 font-medium block">Confirmed Collection</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            ₹{stats.confirmedAmount.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-gray-500">{stats.confirmedCount} Verified</span>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-red-600 font-medium block">Rejected Payments</span>
          <span className="text-2xl font-bold text-red-600 mt-1 block">{stats.rejectedCount}</span>
          <span className="text-[11px] text-gray-400">Not in Total</span>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-purple-600 font-medium block">Refunded / Void</span>
          <span className="text-2xl font-bold text-purple-600 mt-1 block">
            ₹{stats.refundedAmount.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-gray-400">Audited</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md col-span-2 lg:col-span-1">
          <span className="text-xs text-emerald-100 block font-medium">Net Official Total</span>
          <span className="text-2xl font-extrabold mt-1 block">
            ₹{stats.netCollected.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-emerald-200">Confirmed Funds Only</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search campaigns by name, purpose, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <div className="relative">
          <FaFilter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm appearance-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Campaigns</option>
            <option value="closed">Closed Campaigns</option>
            <option value="archived">Archived Campaigns</option>
          </select>
        </div>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading campaigns...</div>
      ) : filteredCollections.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-gray-500 shadow-sm">
          <FaHandHoldingHeart className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No special collections found.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Create Special Collection" above to launch a campaign.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCollections.map((col) => {
            const colPayments = payments.filter((p) => p.collectionId === col.id);
            const confirmed = colPayments.filter((p) => p.status === "confirmed");
            const pending = colPayments.filter((p) => p.status === "pending");
            const rejected = colPayments.filter((p) => p.status === "rejected");
            const refunded = colPayments.filter((p) => p.status === "refunded");

            const confirmedAmt = confirmed.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const pendingAmt = pending.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const netColAmt = confirmedAmt - refunded.reduce((sum, p) => sum + Number(p.amount || 0), 0);

            const progress = col.targetAmount > 0 ? Math.min(100, Math.round((netColAmt / col.targetAmount) * 100)) : 0;

            const isClosed = col.status === "closed";
            const isArchived = col.status === "archived";

            return (
              <div
                key={col.id}
                className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {col.collectionType || "Special Fund"}
                    </span>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                        isClosed
                          ? "bg-gray-100 text-gray-600"
                          : isArchived
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {col.status}
                    </span>
                  </div>

                  {/* Campaign Title & Purpose */}
                  <h3 className="font-bold text-lg text-gray-900 leading-snug">{col.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{col.purpose}</p>

                  {/* Description preview */}
                  {col.description && (
                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-xl line-clamp-2">
                      {col.description}
                    </p>
                  )}

                  {/* Progress & Target */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Collected:</span>
                      <span className="text-emerald-700 font-bold">
                        ₹{netColAmt.toLocaleString("en-IN")}
                        {col.targetAmount > 0 && (
                          <span className="text-gray-400 font-normal"> / ₹{Number(col.targetAmount).toLocaleString("en-IN")}</span>
                        )}
                      </span>
                    </div>

                    {col.targetAmount > 0 && (
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Statistics Micro-Pills */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t text-center">
                    <div className="bg-amber-50 rounded-xl p-2 border border-amber-100">
                      <span className="text-[10px] text-amber-700 font-semibold block uppercase">Pending</span>
                      <span className="text-sm font-bold text-amber-800">{pending.length}</span>
                      <span className="text-[10px] text-amber-600 block">₹{pendingAmt}</span>
                    </div>

                    <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 font-semibold block uppercase">Confirmed</span>
                      <span className="text-sm font-bold text-emerald-800">{confirmed.length}</span>
                      <span className="text-[10px] text-emerald-600 block">₹{confirmedAmt}</span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <span className="text-[10px] text-gray-500 font-semibold block uppercase">Contributors</span>
                      <span className="text-sm font-bold text-gray-800">{colPayments.length}</span>
                      <span className="text-[10px] text-gray-400 block">{col.publicEnabled ? "Public" : "Residents"}</span>
                    </div>
                  </div>

                  {/* Sources / Channels Breakdown */}
                  {colPayments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t text-[11px]">
                      <span className="text-gray-400 font-medium text-[10px]">Sources:</span>
                      {(() => {
                        let resOnline = 0,
                          sharedOnline = 0,
                          adminCash = 0,
                          colCash = 0;

                        colPayments.forEach((p) => {
                          const m = getPaymentChannelMeta(p);
                          if (m.channel === "resident_portal") resOnline++;
                          else if (m.channel === "shared_link") sharedOnline++;
                          else if (m.channel === "collector") colCash++;
                          else if (m.channel === "admin_office") adminCash++;
                        });

                        return (
                          <>
                            {resOnline > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCampaignForPayments(col);
                                  resetPaymentFilters();
                                  setPaymentChannelFilter("resident_portal");
                                }}
                                className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 flex items-center gap-1 transition"
                                title="Filter by Resident Portal"
                              >
                                <FaGlobe className="text-[9px]" /> Portal ({resOnline})
                              </button>
                            )}
                            {sharedOnline > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCampaignForPayments(col);
                                  resetPaymentFilters();
                                  setPaymentChannelFilter("shared_link");
                                }}
                                className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold hover:bg-purple-100 flex items-center gap-1 transition"
                                title="Filter by Shared Form Link"
                              >
                                <FaLink className="text-[9px]" /> Link ({sharedOnline})
                              </button>
                            )}
                            {adminCash > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCampaignForPayments(col);
                                  resetPaymentFilters();
                                  setPaymentChannelFilter("admin_office");
                                }}
                                className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 flex items-center gap-1 transition"
                                title="Filter by Admin Office Direct"
                              >
                                <FaUserShield className="text-[9px]" /> Admin ({adminCash})
                              </button>
                            )}
                            {colCash > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCampaignForPayments(col);
                                  resetPaymentFilters();
                                  setPaymentChannelFilter("collector");
                                }}
                                className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 flex items-center gap-1 transition"
                                title="Filter by Field Collectors"
                              >
                                <FaMotorcycle className="text-[9px]" /> Collector ({colCash})
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Dates & Payment Details info */}
                  <div className="mt-3 text-[11px] text-gray-500 space-y-1">
                    {col.endDate && (
                      <div className="flex items-center gap-1.5">
                        <FaCalendarAlt className="text-gray-400" />
                        <span>Deadline: {new Date(col.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    )}
                    {col.upiId && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-gray-400">UPI:</span>
                        <span className="text-gray-700 font-medium">{col.upiId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedCampaignForPayments(col);
                      resetPaymentFilters();
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FaEye /> Payments ({colPayments.length})
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSharingCampaign(col)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Share Campaign"
                    >
                      <FaShareAlt />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(col)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="Edit Campaign"
                    >
                      <FaEdit />
                    </button>

                    {!isClosed && !isArchived && (
                      <button
                        onClick={() => handleCloseCampaign(col)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Close Campaign"
                      >
                        <FaBan />
                      </button>
                    )}

                    {!isArchived && (
                      <button
                        onClick={() => handleArchiveCampaign(col)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        title="Archive Campaign"
                      >
                        <FaArchive />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CREATE / EDIT CAMPAIGN MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FaHandHoldingHeart className="text-emerald-600" />
                {editingCollection ? "Edit Special Collection" : "Create Special Collection"}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="p-6 space-y-4">
              {/* Campaign Name & Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. D-Block Diwali Celebration 2026"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Purpose *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Festival celebration & society lighting"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed instructions or context for residents and contributors..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Campaign Type & Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Collection Type</label>
                  <select
                    value={formData.collectionType}
                    onChange={(e) => setFormData({ ...formData, collectionType: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {COLLECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({
                      ...formData,
                      targetAudience: e.target.value,
                      publicEnabled: e.target.value === "public_open" || formData.publicEnabled,
                    })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {TARGET_AUDIENCES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contribution Amount Model */}
              <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                <label className="block text-xs font-bold text-gray-800">Contribution Pricing Model</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CONTRIBUTION_TYPES.map((c) => (
                    <label
                      key={c.value}
                      className={`p-3 border rounded-xl cursor-pointer text-xs transition flex flex-col justify-between ${
                        formData.amountType === c.value
                          ? "border-emerald-600 bg-emerald-50/50 font-bold text-emerald-900"
                          : "border-gray-200 hover:bg-white text-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="amountType"
                          checked={formData.amountType === c.value}
                          onChange={() => setFormData({ ...formData, amountType: c.value })}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>{c.label}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Amount inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {formData.amountType === "fixed" && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Fixed Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 500"
                        value={formData.fixedAmount}
                        onChange={(e) => setFormData({ ...formData, fixedAmount: e.target.value })}
                        className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                      />
                    </div>
                  )}

                  {formData.amountType !== "fixed" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Minimum Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 100"
                          value={formData.minimumAmount}
                          onChange={(e) => setFormData({ ...formData, minimumAmount: e.target.value })}
                          className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Maximum Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Optional"
                          value={formData.maximumAmount}
                          onChange={(e) => setFormData({ ...formData, maximumAmount: e.target.value })}
                          className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Overall Target (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 50000"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">End Date / Deadline</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Public External Sharing Toggle */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-amber-900 block cursor-pointer">
                    Enable Public Link (External Contributors)
                  </label>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Allow non-residents (visitors, relatives, local businesses) to contribute via public share link without account login.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.publicEnabled}
                  onChange={(e) => setFormData({ ...formData, publicEnabled: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Payment Account Details (Admin Configurable) */}
              <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <FaMoneyBillWave className="text-blue-600" /> Receiving Payment Accounts (Configured by Admin)
                  </p>
                  <span className="text-[10px] text-blue-600 font-medium">Never hardcoded</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Receiving UPI ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. dblockrwa@upi"
                      value={formData.upiId}
                      onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">UPI Payee Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. D Block RWA Indraprastha"
                      value={formData.upiName}
                      onChange={(e) => setFormData({ ...formData, upiName: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      placeholder="e.g. D Block RWA Indraprastha"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 10023456789"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SBIN0001234"
                      value={formData.ifsc}
                      onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                      className="w-full border rounded-lg p-2 text-sm bg-white font-mono uppercase outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 border rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  {actionLoading ? "Saving..." : editingCollection ? "Save Changes" : "Launch Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PAYMENTS DRAWER / MODAL FOR A CAMPAIGN ─── */}
      {selectedCampaignForPayments && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 bg-gray-50">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{selectedCampaignForPayments.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                    {selectedCampaignForPayments.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>Submissions & Verification Queue</span>
                  <span>•</span>
                  <span className="font-semibold text-gray-700">
                    {campaignPayments.length} of {campaignCounts.total} contributions shown
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Filtered Total: ₹{filteredStats.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCampaignPaymentsCSV}
                  disabled={campaignPayments.length === 0}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 border text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  title="Export filtered records to CSV"
                >
                  <FaFileDownload className="text-emerald-600" /> Export CSV
                </button>
                <button
                  onClick={() => setSelectedCampaignForPayments(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-lg transition"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Filter Sub-bar */}
            <div className="p-3 sm:p-4 border-b bg-white space-y-3">
              {/* Row 1: Status Tabs & Search Input */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: "All", count: campaignCounts.total },
                    { id: "pending", label: "Pending", count: campaignCounts.pending },
                    { id: "confirmed", label: "Confirmed", count: campaignCounts.confirmed },
                    { id: "rejected", label: "Rejected", count: campaignCounts.rejected },
                    { id: "refunded", label: "Refunded", count: campaignCounts.refunded },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setPaymentStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition whitespace-nowrap flex items-center gap-1.5 ${
                        paymentStatusFilter === st.id
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <span>{st.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          paymentStatusFilter === st.id
                            ? "bg-emerald-800 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {st.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Search UTR, name, mobile, collector, flat..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {paymentSearch && (
                    <button
                      onClick={() => setPaymentSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Advanced Source, Mode & Contributor Selectors */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 text-xs">
                {/* Channel / Source Dropdown */}
                <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <FaFilter className="text-gray-400 text-[10px]" />
                  <span className="text-gray-500 text-[11px] font-medium">Source:</span>
                  <select
                    value={paymentChannelFilter}
                    onChange={(e) => setPaymentChannelFilter(e.target.value)}
                    className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                  >
                    <option value="all">All Sources ({campaignCounts.total})</option>
                    <option value="resident_portal">🌐 Resident Portal ({campaignCounts.channels.resident_portal})</option>
                    <option value="shared_link">🔗 Shared Form Link ({campaignCounts.channels.shared_link})</option>
                    <option value="admin_office">🏢 Admin Office Direct ({campaignCounts.channels.admin_office})</option>
                    <option value="collector">🛵 Field Collectors ({campaignCounts.channels.collector})</option>
                  </select>
                </div>

                {/* Payment Mode Dropdown */}
                <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <FaMoneyBillWave className="text-gray-400 text-[10px]" />
                  <span className="text-gray-500 text-[11px] font-medium">Mode:</span>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                  >
                    <option value="all">All Modes ({campaignCounts.total})</option>
                    <option value="cash">💵 Cash Only ({campaignCounts.modes.cash})</option>
                    <option value="online">📱 UPI / Online ({campaignCounts.modes.online})</option>
                  </select>
                </div>

                {/* Contributor Category Dropdown */}
                <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <FaUser className="text-gray-400 text-[10px]" />
                  <span className="text-gray-500 text-[11px] font-medium">Contributor:</span>
                  <select
                    value={paymentCategoryFilter}
                    onChange={(e) => setPaymentCategoryFilter(e.target.value)}
                    className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                  >
                    <option value="all">All Contributors ({campaignCounts.total})</option>
                    <option value="resident">👤 Residents ({campaignCounts.categories.resident})</option>
                    <option value="external">🌍 External Guests ({campaignCounts.categories.external})</option>
                  </select>
                </div>

                {/* Specific Collector Dropdown (if collectors recorded payments) */}
                {Object.keys(campaignCounts.collectors).length > 0 && (
                  <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2.5 py-1">
                    <FaMotorcycle className="text-gray-400 text-[10px]" />
                    <span className="text-gray-500 text-[11px] font-medium">Collector:</span>
                    <select
                      value={paymentCollectorFilter}
                      onChange={(e) => setPaymentCollectorFilter(e.target.value)}
                      className="bg-transparent font-semibold text-gray-800 outline-none text-xs cursor-pointer"
                    >
                      <option value="all">All Collectors</option>
                      {Object.entries(campaignCounts.collectors).map(([colName, cnt]) => (
                        <option key={colName} value={colName}>
                          {colName} ({cnt})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Reset Filters button */}
                {(paymentStatusFilter !== "all" ||
                  paymentChannelFilter !== "all" ||
                  paymentMethodFilter !== "all" ||
                  paymentCollectorFilter !== "all" ||
                  paymentCategoryFilter !== "all" ||
                  Boolean(paymentSearch)) && (
                  <button
                    type="button"
                    onClick={resetPaymentFilters}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <FaTimes className="text-[10px]" /> Clear Filters
                  </button>
                )}
              </div>

              {/* Row 3: Quick Filter Presets Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                <span className="text-[11px] font-semibold text-gray-400 uppercase mr-1 whitespace-nowrap">
                  Quick Presets:
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("resident_portal");
                    setPaymentMethodFilter("online");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "resident_portal" && paymentMethodFilter === "online"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <FaGlobe className="text-[10px]" /> Online (Resident Portal)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("shared_link");
                    setPaymentMethodFilter("online");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "shared_link" && paymentMethodFilter === "online"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  <FaLink className="text-[10px]" /> Online (Shared Link)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("admin_office");
                    setPaymentMethodFilter("cash");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "admin_office" && paymentMethodFilter === "cash"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <FaUserShield className="text-[10px]" /> Cash (Admin Office)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("collector");
                    setPaymentMethodFilter("all");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "collector"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  <FaMotorcycle className="text-[10px]" /> Cash / Direct (Collectors)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("all");
                    setPaymentMethodFilter("cash");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "all" && paymentMethodFilter === "cash"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <FaMoneyBillWave className="text-[10px]" /> All Cash ({campaignCounts.modes.cash})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentChannelFilter("all");
                    setPaymentMethodFilter("online");
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition whitespace-nowrap ${
                    paymentChannelFilter === "all" && paymentMethodFilter === "online"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  <FaQrcode className="text-[10px]" /> All Online ({campaignCounts.modes.online})
                </button>
              </div>

              {/* Row 4: Summary Breakdown Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-[11px] text-gray-500">
                <div>
                  Showing <span className="font-bold text-gray-900">{campaignPayments.length}</span> contributions matching current filters
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                    Total: ₹{filteredStats.totalAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-100">
                    💵 Cash: ₹{filteredStats.cashAmount.toLocaleString("en-IN")}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                    📱 Online: ₹{filteredStats.onlineAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Payments Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {campaignPayments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FaReceipt className="text-3xl mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-600">No payments matching this filter.</p>
                  <p className="text-xs text-gray-400 mt-1">Try clearing some filter criteria to view more records.</p>
                  <button
                    type="button"
                    onClick={resetPaymentFilters}
                    className="mt-3 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b text-gray-600 font-bold">
                      <tr>
                        <th className="p-3">Contributor</th>
                        <th className="p-3">Channel & Category</th>
                        <th className="p-3">Amount & Mode</th>
                        <th className="p-3">UTR / Ref</th>
                        <th className="p-3">Payment Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {campaignPayments.map((p) => {
                        const isPending = p.status === "pending";
                        const isConfirmed = p.status === "confirmed";
                        const isRejected = p.status === "rejected";
                        const isRefunded = p.status === "refunded";
                        const meta = getPaymentChannelMeta(p);

                        return (
                          <tr key={p.id} className="hover:bg-gray-50/80 transition">
                            <td className="p-3">
                              <span className="font-bold text-gray-900 block">{p.contributorName}</span>
                              <span className="text-[11px] text-gray-500">{p.mobileNumber || "—"}</span>
                              {p.flatNumber && (
                                <span className="text-[10px] text-gray-400 block">Flat: {p.flatNumber}</span>
                              )}
                            </td>

                            <td className="p-3 space-y-1">
                              {/* Contributor Category */}
                              <div className="flex items-center gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    meta.contributorCategory === "external"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {meta.contributorCategory === "external" ? "External Guest" : "Resident"}
                                </span>
                              </div>

                              {/* Source Channel Badge */}
                              <div className="flex items-center gap-1">
                                {meta.channel === "resident_portal" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <FaGlobe className="text-[9px]" /> Resident Portal
                                  </span>
                                )}
                                {meta.channel === "shared_link" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    <FaLink className="text-[9px]" /> Shared Form Link
                                  </span>
                                )}
                                {meta.channel === "admin_office" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <FaUserShield className="text-[9px]" /> Admin Office
                                  </span>
                                )}
                                {meta.channel === "collector" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <FaMotorcycle className="text-[9px]" /> Collector: {meta.collectorName}
                                  </span>
                                )}
                              </div>

                              {p.referenceNumber && (
                                <span className="block font-mono text-[10px] text-gray-400">
                                  {p.referenceNumber}
                                </span>
                              )}
                            </td>

                            <td className="p-3">
                              <span className="font-mono font-bold text-sm text-gray-900 block">
                                ₹{Number(p.amount).toLocaleString("en-IN")}
                              </span>
                              {meta.isCash ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                                  <FaMoneyBillWave className="text-[9px]" /> Cash
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5">
                                  <FaQrcode className="text-[9px]" /> {meta.modeLabel}
                                </span>
                              )}
                            </td>

                            <td className="p-3 font-mono">
                              {p.utr === "CASH-OFFLINE" ? (
                                <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  CASH-OFFLINE
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-gray-800 select-all">{p.utr}</span>
                                  <button
                                    onClick={() => copyText(p.utr, "UTR")}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Copy UTR"
                                  >
                                    <FaCopy className="text-[10px]" />
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="p-3 text-gray-500">
                              <span>{p.paymentDate}</span>
                              <span className="block text-[10px] text-gray-400">{p.paymentTime || ""}</span>
                            </td>

                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  isPending
                                    ? "bg-amber-100 text-amber-800"
                                    : isConfirmed
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isRejected
                                    ? "bg-red-100 text-red-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {isPending && <FaClock />}
                                {isConfirmed && <FaCheckCircle />}
                                {isRejected && <FaTimesCircle />}
                                {isRefunded && <FaUndo />}
                                <span className="capitalize">{p.status}</span>
                              </span>

                              {isConfirmed && p.receiptNumber && (
                                <span className="block font-mono text-[10px] text-emerald-700 font-semibold mt-1">
                                  {p.receiptNumber}
                                </span>
                              )}

                              {isRejected && p.rejectionReason && (
                                <span className="block text-[10px] text-red-600 mt-0.5 line-clamp-1">
                                  {p.rejectionReason}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => setConfirmingPayment(p)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] shadow-sm transition"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingPayment(p);
                                        setRejectionReason(REJECTION_REASONS[0]);
                                        setRejectionRemark("");
                                      }}
                                      className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold text-[11px] transition"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {isConfirmed && (
                                  <>
                                    <button
                                      onClick={() =>
                                        printPaymentReceipt({
                                          receiptNumber: p.receiptNumber,
                                          collectionName: selectedCampaignForPayments.name,
                                          purpose: selectedCampaignForPayments.purpose,
                                          contributorName: p.contributorName,
                                          contributorType: p.contributorType === "external" ? "External Contributor" : "Resident",
                                          flatNumber: p.flatNumber,
                                          block: p.block,
                                          mobileNumber: p.mobileNumber,
                                          amount: p.amount,
                                          paymentMethod: p.paymentMethod || p.paymentMode || "Online",
                                          paymentDate: p.paymentDate,
                                          paymentTime: p.paymentTime,
                                          collectorName: p.collectorName || p.confirmedByName || "Society Admin",
                                        })
                                      }
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                                      title="Print Receipt"
                                    >
                                      <FaPrint className="text-sm" />
                                    </button>

                                    <button
                                      onClick={() =>
                                        generateSpecialCollectionReceipt({
                                          receiptNumber: p.receiptNumber,
                                          collectionName: selectedCampaignForPayments.name,
                                          purpose: selectedCampaignForPayments.purpose,
                                          contributorName: p.contributorName,
                                          contributorType: p.contributorType === "external" ? "External Contributor" : "Resident",
                                          flatNumber: p.flatNumber,
                                          block: p.block,
                                          mobileNumber: p.mobileNumber,
                                          amount: p.amount,
                                          utr: p.utr,
                                          paymentDate: p.paymentDate,
                                          confirmedByName: p.confirmedByName || "Society Admin",
                                        })
                                      }
                                      className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition cursor-pointer"
                                      title="Download Receipt PDF"
                                    >
                                      <FaFileDownload className="text-sm" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        setRefundingPayment(p);
                                        setRefundReason("");
                                      }}
                                      className="px-2 py-1 text-purple-600 hover:bg-purple-50 rounded font-medium text-[11px] transition"
                                      title="Refund or Void payment"
                                    >
                                      Refund
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedCampaignForPayments(null)}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM PAYMENT DIALOG (WITH BANK CHECK WARNING) ─── */}
      {confirmingPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                <FaCheckCircle />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Confirm Payment</h3>
                <p className="text-xs text-gray-500">Official verification in society records</p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1.5 text-emerald-950">
              <p className="font-semibold text-emerald-900">Please verify before confirming:</p>
              <p>Check the society's actual bank account or UPI statements to verify that this amount was credited.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Contributor:</span>
                <span className="font-bold text-gray-800">{confirmingPayment.contributorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">₹{confirmingPayment.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Claimed UTR:</span>
                <span className="font-bold text-gray-900">{confirmingPayment.utr}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingPayment(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmPaymentSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {actionLoading ? "Confirming..." : "Confirm & Issue Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REJECT PAYMENT DIALOG ─── */}
      {rejectingPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-lg">
                <FaTimesCircle />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Reject Payment Submission</h3>
                <p className="text-xs text-gray-500">Amount will NOT be added to collection totals</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason *</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-400 bg-white"
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Admin Remarks (optional)</label>
              <textarea
                rows={2}
                placeholder="Details to explain to contributor..."
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectPaymentSubmit}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── REFUND / VOID PAYMENT DIALOG ─── */}
      {refundingPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-purple-600">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">
                <FaUndo />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Record Refund / Void</h3>
                <p className="text-xs text-gray-500">Transaction remains auditable; net total will adjust</p>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900">
              Original Payment: <strong>₹{refundingPayment.amount}</strong> from <strong>{refundingPayment.contributorName}</strong> (UTR: {refundingPayment.utr})
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Refund *</label>
              <textarea
                rows={2}
                required
                placeholder="State why this confirmed payment is being refunded/voided..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRefundingPayment(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !refundReason.trim()}
                onClick={handleRefundPaymentSubmit}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {actionLoading ? "Processing..." : "Process Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SHARING MODAL ─── */}
      {sharingCampaign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FaShareAlt className="text-blue-600" /> Share Special Collection
              </h3>
              <button onClick={() => setSharingCampaign(null)} className="text-gray-400 hover:text-gray-700">
                <FaTimes />
              </button>
            </div>

            <div>
              <h4 className="font-bold text-base text-gray-900">{sharingCampaign.name}</h4>
              <p className="text-xs text-gray-500">{sharingCampaign.purpose}</p>
            </div>

            {/* WhatsApp Share Box */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  const targetUrl = sharingCampaign.publicEnabled
                    ? `${window.location.origin}/public/collections/${sharingCampaign.id}`
                    : `${window.location.origin}/resident/special-collections`;
                  const text =
                    `🎉 *${sharingCampaign.name}*\n` +
                    `Purpose: ${sharingCampaign.purpose}\n` +
                    (sharingCampaign.fixedAmount > 0 ? `Contribution: ₹${sharingCampaign.fixedAmount}\n` : "") +
                    (sharingCampaign.upiId ? `Payment UPI: ${sharingCampaign.upiId}\n` : "") +
                    `\nYou can contribute online here:\n${targetUrl}\n\n` +
                    `Thank you for supporting D-Block RWA!`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
              >
                <FaWhatsapp className="text-base" /> Share on WhatsApp
              </button>

              {/* Public Link Copy */}
              {sharingCampaign.publicEnabled ? (
                <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
                  <span className="text-[11px] font-bold text-gray-700 block">Public Contribution Link (No login required):</span>
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border text-xs font-mono text-gray-600">
                    <span className="truncate">{`${window.location.origin}/public/collections/${sharingCampaign.id}`}</span>
                    <button
                      onClick={() => copyText(`${window.location.origin}/public/collections/${sharingCampaign.id}`, "Public link")}
                      className="text-blue-600 hover:underline font-bold text-[11px] shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-800">
                  <p className="font-semibold">Resident Portal Link:</p>
                  <p className="text-[11px] mt-0.5">This campaign is configured for society residents only.</p>
                  <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-blue-200 text-xs font-mono text-gray-600 mt-1">
                    <span className="truncate">{`${window.location.origin}/resident/special-collections`}</span>
                    <button
                      onClick={() => copyText(`${window.location.origin}/resident/special-collections`, "Resident portal link")}
                      className="text-blue-600 hover:underline font-bold text-[11px] shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSharingCampaign(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CASH / OFFLINE CONTRIBUTION MODAL ─── */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <FaMoneyBillWave className="text-emerald-600 text-lg" /> Record Cash / Offline Contribution
              </h3>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleRecordCashSubmit} className="space-y-4">
              {/* Campaign Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Collection Campaign <span className="text-red-500">*</span>
                </label>
                <select
                  value={cashFormData.collectionId}
                  onChange={(e) => handleCashCampaignChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Select Active Campaign --</option>
                  {collections
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.collectionType} — {c.amountType === "fixed" ? `₹${c.fixedAmount} fixed` : "Flexible"})
                      </option>
                    ))}
                </select>
                {collections.filter((c) => c.status === "active").length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No active collection campaigns found. Please create or activate a campaign first.
                  </p>
                )}
              </div>

              {/* Contributor Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contributor Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCashFormData((prev) => ({
                        ...prev,
                        contributorType: "resident",
                      }))
                    }
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      cashFormData.contributorType === "resident"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    Society Resident
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCashFormData((prev) => ({
                        ...prev,
                        contributorType: "external",
                        residentId: "",
                        contributorName: "",
                        flatNumber: "",
                        block: "",
                        mobileNumber: "",
                      }))
                    }
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      cashFormData.contributorType === "external"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    External Contributor / Guest
                  </button>
                </div>
              </div>

              {/* Resident Picker vs External Fields */}
              {cashFormData.contributorType === "resident" ? (
                <div className="space-y-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Resident <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={cashFormData.residentId}
                      onChange={(e) => handleCashResidentChange(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      required
                    >
                      <option value="">-- Choose Resident (Flat / Name) --</option>
                      {residents
                        .slice()
                        .sort((a, b) => (a.flatNumber || "").localeCompare(b.flatNumber || ""))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Flat {r.flatNumber || "—"} ({r.block || "—"}) — {r.name || "Resident"}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 block">Name:</span>
                      <span className="font-semibold text-gray-900">{cashFormData.contributorName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Flat / Block:</span>
                      <span className="font-semibold text-gray-900">
                        {cashFormData.flatNumber ? `${cashFormData.flatNumber} (${cashFormData.block || "—"})` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Mobile:</span>
                      <span className="font-semibold text-gray-900">{cashFormData.mobileNumber || "—"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 p-3 rounded-xl border">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Contributor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={cashFormData.contributorName}
                      onChange={(e) =>
                        setCashFormData((prev) => ({ ...prev, contributorName: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Flat / House / Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Shop 4 / Guest"
                        value={cashFormData.flatNumber}
                        onChange={(e) =>
                          setCashFormData((prev) => ({ ...prev, flatNumber: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={cashFormData.mobileNumber}
                        onChange={(e) =>
                          setCashFormData((prev) => ({ ...prev, mobileNumber: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Amount & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 500"
                    value={cashFormData.amount}
                    onChange={(e) =>
                      setCashFormData((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={cashFormData.paymentMethod}
                    onChange={(e) =>
                      setCashFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Offline UPI">Offline UPI (Direct QR scan)</option>
                    <option value="Cheque">Cheque / Demand Draft</option>
                    <option value="Bank Transfer">Direct Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Collector & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Collected By</label>
                  <select
                    value={cashFormData.collectorId}
                    onChange={(e) =>
                      setCashFormData((prev) => ({ ...prev, collectorId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="admin">RWA Admin / Office</option>
                    {collectors
                      .filter((c) => c.status === "active")
                      .map((col) => (
                        <option key={col.id || col.uid} value={col.id || col.uid}>
                          Collector: {col.name} ({col.phone || col.mobile || "Active"})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={cashFormData.paymentDate}
                    onChange={(e) =>
                      setCashFormData((prev) => ({ ...prev, paymentDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Remarks / Receipt Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid cash at society office / Receipt book ref #42"
                  value={cashFormData.remarks}
                  onChange={(e) =>
                    setCashFormData((prev) => ({ ...prev, remarks: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cashSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <FaReceipt />
                  {cashSubmitting ? "Generating Receipt..." : "Record & Issue Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CASH PAYMENT RECEIPT MODAL ─── */}
      {cashReceiptModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-2xl shadow-inner">
                <FaCheckCircle />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Payment Recorded Successfully!</h3>
              <p className="text-xs text-gray-500">
                Official Special Collection receipt has been generated and saved.
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-emerald-200">
                <span className="text-gray-600 font-medium">Receipt No:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {cashReceiptModal.receiptNumber}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Campaign:</span>
                <span className="font-bold text-gray-900 text-right">{cashReceiptModal.collectionName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Contributor:</span>
                <span className="font-semibold text-gray-900">
                  {cashReceiptModal.contributorName}{" "}
                  {cashReceiptModal.flatNumber ? `(Flat ${cashReceiptModal.flatNumber})` : ""}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-extrabold text-base text-emerald-700">
                  ₹{Number(cashReceiptModal.amount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium text-gray-800">{cashReceiptModal.paymentMethod || "Cash"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Received By:</span>
                <span className="font-medium text-gray-800">{cashReceiptModal.collectorName || "RWA Office"}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-emerald-200">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium text-gray-800">{cashReceiptModal.paymentDate}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => printPaymentReceipt(cashReceiptModal)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <FaPrint /> Print Receipt
              </button>
              <button
                onClick={() => generateSpecialCollectionReceipt(cashReceiptModal)}
                className="flex-1 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 active:scale-95 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <FaFileDownload /> Download PDF
              </button>
              <button
                onClick={() => setCashReceiptModal(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
