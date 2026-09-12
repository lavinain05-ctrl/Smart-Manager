import { useState, useMemo } from "react";
import {
  FaPlus,
  FaExclamationTriangle,
  FaTimes,
  FaTrash,
  FaUsers,
  FaUser,
  FaKey,
  FaCopy,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaSync,
  FaBan,
  FaClock,
  FaUnlock,
} from "react-icons/fa";

import toast from "react-hot-toast";

import AddResidentDrawer from "../../components/forms/AddResidentDrawer";
import SearchBar from "../../components/residents/SearchBar";
import ResidentsTable from "../../components/residents/ResidentsTable";
import StatsCards from "../../components/residents/StatsCards";
import MonthSelector from "../../components/common/MonthSelector";
import PendingDuesModal from "../../components/residents/PendingDuesModal";
import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import { collectResidentPayment } from "../../utils/collectPayment";

import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useBills } from "../../context/BillContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useGarbage } from "../../context/GarbageContext";
import { useAuth } from "../../context/AuthContext";
import { deleteUserAccount } from "../../services/accountDeletionService";
import { subscribeFamilyMembers } from "../../services/residentService";
import { getGarbageMonthlyStats, isGcParticipating } from "../../services/statisticsService";
import { adminResetPasswordFn, db } from "../../firebase/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { blockAccount, unblockAccount } from "../../services/blockService";

export default function Residents() {
  const {
    residents,
    addResident,
    updateResident,
  } = useResidents();

  const { payments, addPayment } = usePayments();
  const { bills } = useBills();
  const { selectedMonth, selectedYear } = useBilling();
  const { blocks } = useBlockFlat();
  const { garbageBills, reconcileGarbageAccounts } = useGarbage();
  const { user } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    gc: "all",
    payment: "all",
    block: "all",
    addedBy: "all",
  });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [familyAction, setFamilyAction] = useState("delete");
  const [familyCount, setFamilyCount] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Direct Reset Password state
  const [resetTarget, setResetTarget] = useState(null);
  const [customPassword, setCustomPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState("");
  const [copied, setCopied] = useState(false);

  // Block state
  const [blockTarget, setBlockTarget] = useState(null);
  const [blockModalType, setBlockModalType] = useState("temporary");
  const [blockModalDays, setBlockModalDays] = useState(3);
  const [blockModalReason, setBlockModalReason] = useState("Maintenance / Garbage Dues Pending");
  const [blockModalDetails, setBlockModalDetails] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  // Pending Dues & Direct Collection State
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [collectTarget, setCollectTarget] = useState(null);
  const [collectMonth, setCollectMonth] = useState("");
  const [collectYear, setCollectYear] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);

  function handleOpenCollectFromPending(resident, month, year) {
    setCollectTarget(resident);
    setCollectMonth(month);
    setCollectYear(year);
    setPaymentModalOpen(true);
  }

  function handleOpenBlock(resident) {
    setBlockTarget(resident);
    setBlockModalType("temporary");
    setBlockModalDays(3);
    setBlockModalReason("Maintenance / Garbage Dues Pending");
    setBlockModalDetails("");
  }

  async function handleConfirmBlockResident(e) {
    e.preventDefault();
    if (!blockTarget) return;

    if (!blockTarget.mobile) {
      toast.error("This resident has no registered mobile number to enforce block");
      return;
    }

    setBlockLoading(true);
    try {
      if (blockTarget.isBlocked || blockTarget.status === "Blocked") {
        await unblockAccount(blockTarget.mobile, user);
        toast.success(`Access restored for ${blockTarget.owner}`);
      } else {
        let blockedUntil = null;
        if (blockModalType === "temporary") {
          const d = new Date();
          d.setDate(d.getDate() + Number(blockModalDays));
          blockedUntil = d;
        }

        const fullReason = blockModalDetails
          ? `${blockModalReason}: ${blockModalDetails}`
          : blockModalReason;

        await blockAccount({
          mobile: blockTarget.mobile,
          userId: blockTarget.id,
          name: blockTarget.owner,
          role: "resident",
          blockType: blockModalType,
          blockedUntil,
          reason: fullReason,
          adminUser: user,
        });

        toast.success(
          `Successfully ${blockModalType === "temporary" ? "suspended" : "blocked"} ${blockTarget.owner}`
        );
      }
      setBlockTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Block action failed");
    } finally {
      setBlockLoading(false);
    }
  }

  function handleOpenResetPassword(resident) {
    setResetTarget(resident);
    setCustomPassword("");
    setTempPasswordResult("");
    setCopied(false);
  }

  async function handleConfirmResetPassword(e) {
    e.preventDefault();
    if (!resetTarget) return;

    if (customPassword && customPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setResetLoading(true);
      const chosenPassword =
        customPassword ||
        "RWA@" + Math.floor(100000 + Math.random() * 900000);

      // 1. Try Cloud Function
      try {
        const result = await adminResetPasswordFn({
          targetUid: resetTarget.id,
          password: chosenPassword,
        });
        if (result?.data?.tempPassword) {
          setTempPasswordResult(result.data.tempPassword);
          toast.success("Password reset successfully!");
          return;
        }
      } catch (fnErr) {
        console.warn("Cloud function reset:", fnErr.message);
      }

      // 2. Mark mustChangePassword flag on user document
      try {
        await updateDoc(doc(db, "users", resetTarget.id), {
          mustChangePassword: true,
          tempPasswordSetAt: serverTimestamp(),
        });
      } catch (docErr) {
        console.warn("User doc update:", docErr.message);
      }

      setTempPasswordResult(chosenPassword);
      toast.success("Password reset registered! Please share with resident.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  // ─── Centralized GC stats for the selected month ───
  const gcMonthlyStats = useMemo(
    () => getGarbageMonthlyStats(residents, garbageBills, selectedMonth, selectedYear, payments, bills),
    [residents, garbageBills, selectedMonth, selectedYear, payments, bills]
  );

  // Monthly maintenance payments for the selected period
  const currentMonthPayments = useMemo(
    () => payments.filter(
      (p) => p.month === selectedMonth && Number(p.year) === Number(selectedYear)
    ),
    [payments, selectedMonth, selectedYear]
  );

  // Monthly bills for the selected period (scoped strictly to selectedMonth and selectedYear)
  const currentMonthBills = useMemo(
    () => bills.filter(
      (b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear)
    ),
    [bills, selectedMonth, selectedYear]
  );

  async function handleConfirmCollect(paymentData) {
    if (!collectTarget) return;
    try {
      const receipt = await collectResidentPayment({
        resident: collectTarget,
        month: collectMonth || selectedMonth,
        year: collectYear || selectedYear,
        paymentData,
        bills,
        addPayment,
        collector: user?.name || "Admin",
        collectorId: user?.uid || null,
      });

      if (receipt) {
        setPaymentModalOpen(false);
        setSuccessReceipt(receipt);
      }
    } catch (err) {
      console.error("Payment collection error:", err);
      toast.error("Failed to record payment");
    }
  }

  // Active blocks for filter dropdown
  const activeBlocks = useMemo(
    () => blocks.filter((b) => b.status === "active" || !b.status),
    [blocks]
  );

  async function handleSave(data) {
    if (editingResident) {
      await updateResident(editingResident.id, data);
    } else {
      const isCommitteeUser = user?.role === "committee";
      await addResident({
        ...data,
        createdBy: isCommitteeUser ? "Committee" : "Admin",
        createdById: user?.uid || "",
        createdByName: user?.name || user?.email || (isCommitteeUser ? "Committee Member" : "Admin"),
        accessProvenance: {
          grantedByUid: user?.uid || "",
          grantedByName: user?.name || (isCommitteeUser ? "Committee Member" : "Administrator"),
          grantedByRole: user?.role || "admin",
          grantedByDesignation: user?.designation || (isCommitteeUser ? "Committee Member" : "Admin"),
          grantedAt: new Date().toISOString(),
          channel: isCommitteeUser ? "committee_portal" : "admin_panel",
        },
      });
    }

    setEditingResident(null);
    setDrawerOpen(false);
  }

  async function handleSyncAll() {
    try {
      setSyncing(true);
      const res = await reconcileGarbageAccounts();
      toast.success(
        `Sync complete: ${res?.statusSynced || 0} statuses updated, ${res?.accountsCreated || 0} accounts enrolled`,
        { duration: 4000 }
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to synchronize resident data");
    } finally {
      setSyncing(false);
    }
  }

  function handleEdit(resident) {
    setEditingResident(resident);
    setDrawerOpen(true);
  }

  function handleDelete(id) {
    const resident = residents.find((r) => r.id === id);
    if (!resident) return;

    setDeleteTarget(resident);
    setDeleteReason("");
    setFamilyAction("deactivate");
    setFamilyCount(0);

    // Count family members
    const unsub = subscribeFamilyMembers(id, (members) => {
      setFamilyCount(members.length);
      unsub();
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const results = await deleteUserAccount({
        userId: deleteTarget.id,
        userName: deleteTarget.owner,
        userEmail: deleteTarget.email || "",
        userPhone: deleteTarget.mobile || "",
        userRole: "resident",
        userFlat: deleteTarget.flat,
        userBlock: deleteTarget.block,
        deletionReason: deleteReason,
        familyAction,
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
        registeredAt: deleteTarget.approvedAt || null,
        approvedAt: deleteTarget.approvedAt || null,
      });

      if (results.success) {
        if (results.authDeleted) {
          toast.success("Account permanently deleted — registered phone & login details removed from Firebase");
        } else {
          toast.success("Account and registered phone deleted from database");
        }
        if (results.errors.length > 0) {
          console.warn("Deletion completed with warnings:", results.errors);
        }
      } else {
        toast.error("Deletion encountered errors — check console");
        console.error("Deletion errors:", results.errors);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete account");
    }

    setDeleteTarget(null);
    setDeleteReason("");
    setDeleteLoading(false);
  }

  // Dynamic list of collectors who have added residents
  const addedByCollectors = useMemo(() => {
    const set = new Set();
    residents.forEach((r) => {
      const prov = r.accessProvenance;
      if (r.createdBy === "Collector" || r.collectorId || (prov && (prov.grantedByRole || "").toLowerCase() === "collector")) {
        const name = (r.createdByName || r.collectorName || prov?.grantedByName || "Collector").trim();
        if (name) set.add(name);
      }
    });
    return Array.from(set).sort();
  }, [residents]);

  // Dynamic list of committee members who have granted access or added residents
  const addedByCommittee = useMemo(() => {
    const set = new Set();
    residents.forEach((r) => {
      const prov = r.accessProvenance;
      if (prov && (prov.grantedByRole || "").toLowerCase() === "committee") {
        const name = (prov.grantedByName || "").trim();
        if (name) set.add(name);
      } else if (r.createdBy === "Committee") {
        const name = (r.createdByName || "").trim();
        if (name) set.add(name);
      }
    });
    return Array.from(set).sort();
  }, [residents]);

  // ─── Filter + Search Logic ───
  const filteredResidents = useMemo(() => {
    return residents.filter((resident) => {
      // 1. Search
      const value = search.toLowerCase();
      if (value) {
        const matchesSearch =
          resident.flat?.toLowerCase().includes(value) ||
          resident.owner?.toLowerCase().includes(value) ||
          resident.mobile?.includes(value) ||
          resident.block?.toLowerCase().includes(value);
        if (!matchesSearch) return false;
      }

      // 2. Status filter
      if (filters.status !== "all") {
        const isActive = resident.status !== "Inactive" && resident.status !== "inactive";
        if (filters.status === "active" && !isActive) return false;
        if (filters.status === "inactive" && isActive) return false;
      }

      // 3. GC filter
      if (filters.gc !== "all") {
        const participating = isGcParticipating(resident);
        if (filters.gc === "participating" && !participating) return false;
        if (filters.gc === "not_participating" && participating) return false;
      }

      // 4. Payment filter (GC payment for selected month)
      if (filters.payment !== "all") {
        if (!isGcParticipating(resident)) {
          // Non-participating: exclude from payment filter results
          if (filters.payment === "paid") return false;
          if (filters.payment === "pending") return false;
        } else {
          const isPaid = gcMonthlyStats.paidResidentIds.has(resident.id);
          if (filters.payment === "paid" && !isPaid) return false;
          if (filters.payment === "pending" && isPaid) return false;
        }
      }

      // 5. Block filter
      if (filters.block !== "all") {
        if ((resident.block || "").toLowerCase() !== filters.block.toLowerCase()) return false;
      }

      // 6. Added By / Access Origin filter
      if (filters.addedBy && filters.addedBy !== "all") {
        const provRole = (resident.accessProvenance?.grantedByRole || "").toLowerCase();
        const isCollector = resident.createdBy === "Collector" || Boolean(resident.collectorId) || provRole === "collector";
        const isCommittee = resident.createdBy === "Committee" || provRole === "committee";

        if (filters.addedBy === "admin") {
          if (isCollector || isCommittee) return false;
        } else if (filters.addedBy === "committee") {
          if (!isCommittee) return false;
        } else if (filters.addedBy === "collector") {
          if (!isCollector) return false;
        } else if (filters.addedBy.startsWith("collector:")) {
          const target = filters.addedBy.replace("collector:", "").trim().toLowerCase();
          const rName = (resident.createdByName || resident.collectorName || resident.accessProvenance?.grantedByName || "").trim().toLowerCase();
          if (rName !== target) return false;
        } else if (filters.addedBy.startsWith("committee:")) {
          const target = filters.addedBy.replace("committee:", "").trim().toLowerCase();
          const rName = (resident.createdByName || resident.accessProvenance?.grantedByName || "").trim().toLowerCase();
          if (rName !== target) return false;
        }
      }

      return true;
    });
  }, [residents, search, filters, gcMonthlyStats]);

  return (
    <>
      <div className="space-y-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Residents</h1>
            <p className="text-gray-500">
              Manage all residents of the society
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPendingModal(true)}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-3 rounded-xl font-semibold transition shadow-sm text-sm"
              title="Check list of residents with pending payments"
            >
              <FaClock className="text-red-600" />
              Pending Dues
              {gcMonthlyStats?.pendingResidents > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {gcMonthlyStats.pendingResidents}
                </span>
              )}
            </button>

            <button
              onClick={handleSyncAll}
              disabled={syncing}
              title="Synchronize all resident GC statuses and garbage accounts"
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-3 rounded-xl font-semibold transition shadow-sm disabled:opacity-50 text-sm"
            >
              <FaSync className={syncing ? "animate-spin text-blue-600" : "text-blue-600"} />
              {syncing ? "Syncing..." : "Sync All Data"}
            </button>

            <button
              onClick={() => {
                setEditingResident(null);
                setDrawerOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition"
            >
              <FaPlus /> Add Resident
            </button>
          </div>
        </div>

        {/* Month Selector */}
        <MonthSelector />

        <StatsCards
          residents={residents}
          payments={currentMonthPayments}
          gcMonthlyStats={gcMonthlyStats}
          onOpenPendingModal={() => setShowPendingModal(true)}
        />

        <SearchBar
          search={search}
          setSearch={setSearch}
          filters={filters}
          onFilterChange={setFilters}
          blocks={activeBlocks}
          addedByCollectors={addedByCollectors}
          addedByCommittee={addedByCommittee}
        />

        <ResidentsTable
          residents={filteredResidents}
          payments={currentMonthPayments}
          bills={currentMonthBills}
          gcMonthlyStats={gcMonthlyStats}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onResetPassword={handleOpenResetPassword}
          onBlock={handleOpenBlock}
        />

        {/* Comprehensive Delete Dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50 rounded-t-2xl">
                <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                  <FaTrash /> Delete Account
                </h2>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-100 transition"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Warning */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <FaExclamationTriangle className="text-red-500 text-lg mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-red-700 text-sm">This action cannot be undone.</p>
                    <p className="text-red-600 text-xs mt-1">
                      All related data will be permanently deleted or archived. Payment records will be preserved for audit.
                    </p>
                  </div>
                </div>

                {/* Resident Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <FaUser className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-bold">{deleteTarget.owner}</p>
                      <p className="text-sm text-gray-500">
                        Flat {deleteTarget.flat} • Block {deleteTarget.block} • {deleteTarget.mobile}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Cleanup Summary */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 mb-2">The following will be cleaned up:</p>
                  <ul className="text-xs text-amber-600 space-y-1">
                    <li>• User login credentials & role document</li>
                    <li>• Resident profile document</li>
                    <li>• Notifications & profile update requests</li>
                    <li>• Complaints (archived)</li>
                    <li>• Payments & bills (anonymized for audit trail)</li>
                    <li>• Registration request record</li>
                    {isGcParticipating(deleteTarget) && (
                      <li>• Garbage collection records</li>
                    )}
                  </ul>
                </div>

                {/* Family Members */}
                {familyCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-700 flex items-center gap-1 mb-3">
                      <FaUsers /> {familyCount} Linked Family Member{familyCount > 1 ? "s" : ""}
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="familyAction"
                          value="deactivate"
                          checked={familyAction === "deactivate"}
                          onChange={(e) => setFamilyAction(e.target.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">Deactivate family accounts (recommended)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="familyAction"
                          value="delete"
                          checked={familyAction === "delete"}
                          onChange={(e) => setFamilyAction(e.target.value)}
                          className="text-red-600"
                        />
                        <span className="text-sm">Delete family accounts permanently</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="familyAction"
                          value="keep"
                          checked={familyAction === "keep"}
                          onChange={(e) => setFamilyAction(e.target.value)}
                          className="text-gray-600"
                        />
                        <span className="text-sm">Keep family accounts unchanged</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block mb-2 font-medium text-sm">Deletion Reason</label>
                  <textarea
                    placeholder="Reason for deletion (optional)..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={2}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                  className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold transition flex items-center gap-2"
                >
                  <FaTrash />
                  {deleteLoading ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Direct Reset Password Dialog */}
        {resetTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
                <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
                  <FaKey /> Reset Resident Password
                </h2>
                <button
                  onClick={() => {
                    setResetTarget(null);
                    setTempPasswordResult("");
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-amber-100 transition"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Resident Summary */}
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                    <FaUser />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{resetTarget.owner}</p>
                    <p className="text-sm text-gray-500">
                      Mobile: <span className="font-mono font-semibold text-gray-700">{resetTarget.mobile}</span> • Flat: {resetTarget.flat} • Block: {resetTarget.block}
                    </p>
                  </div>
                </div>

                {tempPasswordResult ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                      <FaCheckCircle className="text-green-600 text-xl mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-green-800">Temporary Password Ready</p>
                        <p className="text-xs text-green-700 mt-1">
                          Share this temporary password with <strong>{resetTarget.owner}</strong>. When they log in with their mobile number and this password, they will be prompted to set their own permanent password.
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-100 border rounded-xl p-4 text-center">
                      <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">
                        Temporary Password
                      </span>
                      <div className="flex items-center justify-center gap-3 mt-1">
                        <span className="text-2xl font-mono font-bold text-gray-900 tracking-wider select-all">
                          {tempPasswordResult}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(tempPasswordResult);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <FaCopy /> {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Spark plan helper */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1.5 text-left">
                      <p className="font-semibold text-blue-900">💡 Firebase Spark Plan Note:</p>
                      <p>
                        If Cloud Functions are not active on your Firebase plan, you can also paste this temporary password directly in Firebase Auth:
                      </p>
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-blue-200 font-mono text-xs text-gray-700">
                        <span>Auth Email: {resetTarget.mobile}@smart-manager-aad4d.firebaseapp.com</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${resetTarget.mobile}@smart-manager-aad4d.firebaseapp.com`);
                            toast.success("Auth email copied!");
                          }}
                          className="text-blue-600 hover:underline font-bold text-[11px] ml-2"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="pt-0.5">
                        <a
                          href="https://console.firebase.google.com/project/smart-manager-aad4d/authentication/users"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold underline"
                        >
                          Open Firebase Console Users <FaExternalLinkAlt className="text-[10px]" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                    <div>
                      <label className="block mb-1.5 text-sm font-medium text-gray-700">
                        Temporary Password <span className="text-gray-400 font-normal">(Leave blank to auto-generate)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123456 or leave blank for random code"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-mono"
                        minLength={6}
                      />
                      <p className="text-xs text-gray-500 mt-1.5">
                        Minimum 6 characters. The resident will be forced to change this upon their next login.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setResetTarget(null)}
                        className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold transition text-sm flex items-center gap-2 shadow-sm"
                      >
                        <FaKey />
                        {resetLoading ? "Resetting..." : "Confirm & Reset Password"}
                      </button>
                    </div>
                  </form>
                )}

                {tempPasswordResult && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setResetTarget(null);
                        setTempPasswordResult("");
                      }}
                      className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold transition text-sm"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Block / Suspend Resident Modal */}
        {blockTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                    blockTarget.isBlocked || blockTarget.status === "Blocked"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-600"
                  }`}>
                    {blockTarget.isBlocked || blockTarget.status === "Blocked" ? <FaUnlock /> : <FaBan />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">
                      {blockTarget.isBlocked || blockTarget.status === "Blocked"
                        ? "Restore Resident Access"
                        : "Block or Suspend Access"}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {blockTarget.owner} • Flat: {blockTarget.flat || "—"} ({blockTarget.mobile || "No Mobile"})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setBlockTarget(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <FaTimes />
                </button>
              </div>

              {blockTarget.isBlocked || blockTarget.status === "Blocked" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    This account is currently blocked. Restoring access will allow the resident to log in to their resident portal immediately.
                  </p>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setBlockTarget(null)}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBlockResident}
                      disabled={blockLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <FaUnlock /> {blockLoading ? "Restoring..." : "Restore Portal Access"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmBlockResident} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                      Suspension Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBlockModalType("temporary")}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          blockModalType === "temporary"
                            ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        <FaClock /> Temporary
                      </button>

                      <button
                        type="button"
                        onClick={() => setBlockModalType("permanent")}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          blockModalType === "permanent"
                            ? "bg-red-50 border-red-300 text-red-800 shadow-sm"
                            : "bg-white border-gray-200 text-gray-600"
                        }`}
                      >
                        <FaBan /> Permanent
                      </button>
                    </div>
                  </div>

                  {blockModalType === "temporary" && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-amber-900 block">
                        Choose Duration:
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: "24h", days: 1 },
                          { label: "3 Days", days: 3 },
                          { label: "7 Days", days: 7 },
                          { label: "15 Days", days: 15 },
                        ].map((opt) => (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => setBlockModalDays(opt.days)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                              blockModalDays === opt.days
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white text-slate-700 border-amber-200"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                      Reason for Block
                    </label>
                    <select
                      value={blockModalReason}
                      onChange={(e) => setBlockModalReason(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-red-500 mb-2"
                    >
                      <option value="Maintenance / Garbage Dues Pending">Maintenance / Garbage Dues Pending</option>
                      <option value="Code of Conduct / Society Rule Violation">Code of Conduct / Society Rule Violation</option>
                      <option value="Security Concern / Suspicious Activity">Security Concern / Suspicious Activity</option>
                      <option value="Disciplinary Temporary Suspension">Disciplinary Temporary Suspension</option>
                      <option value="Misuse of Portal / Spam">Misuse of Portal / Spam</option>
                      <option value="Other / Custom Reason">Other / Custom Reason</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Additional details to display to resident upon login..."
                      value={blockModalDetails}
                      onChange={(e) => setBlockModalDetails(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setBlockTarget(null)}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={blockLoading}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <FaBan /> {blockLoading ? "Applying..." : "Block Resident Access"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>

      <AddResidentDrawer
        open={drawerOpen}
        resident={editingResident}
        onSave={handleSave}
        onClose={() => {
          setDrawerOpen(false);
          setEditingResident(null);
        }}
      />

      {/* Pending Dues Checklist Modal */}
      <PendingDuesModal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        residents={residents}
        bills={bills}
        garbageBills={garbageBills}
        payments={payments}
        gcMonthlyStats={gcMonthlyStats}
        currentMonth={selectedMonth}
        currentYear={selectedYear}
        onCollectPayment={handleOpenCollectFromPending}
      />

      {/* 1-Click Direct Payment Modal from Pending List */}
      {paymentModalOpen && collectTarget && (
        <PaymentModal
          open={paymentModalOpen}
          resident={collectTarget}
          month={collectMonth || selectedMonth}
          year={collectYear || selectedYear}
          onClose={() => {
            setPaymentModalOpen(false);
            setCollectTarget(null);
          }}
          onCollect={handleConfirmCollect}
        />
      )}

      {/* Payment Success Receipt */}
      {successReceipt && (
        <PaymentReceiptSuccessModal
          open={Boolean(successReceipt)}
          receipt={successReceipt}
          onClose={() => setSuccessReceipt(null)}
        />
      )}
    </>
  );
}