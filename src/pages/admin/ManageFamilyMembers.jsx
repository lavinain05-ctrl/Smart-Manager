import { useState, useEffect, useMemo } from "react";
import {
  FaUsers,
  FaPlus,
  FaTimes,
  FaTrash,
  FaSearch,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaUser,
  FaHeart,
  FaEdit,
  FaKey,
  FaBan,
  FaUnlock,
  FaThLarge,
  FaList,
  FaCheckCircle,
  FaCopy,
  FaCheck,
  FaClock,
  FaSync,
  FaShieldAlt,
  FaInfoCircle,
  FaBuilding,
  FaUserCheck,
} from "react-icons/fa";

import toast from "react-hot-toast";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AddFamilyMemberDrawer from "../../components/forms/AddFamilyMemberDrawer";

import {
  subscribeAllFamilyMembers,
  addFamilyMemberAccount,
  updateFamilyMemberAccount,
} from "../../services/residentService";

import { deleteUserAccount } from "../../services/accountDeletionService";
import { blockAccount, unblockAccount } from "../../services/blockService";
import { adminResetPasswordFn, db } from "../../firebase/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { useResidents } from "../../context/ResidentContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useAuth } from "../../context/AuthContext";

const RELATION_BADGES = {
  Spouse: "bg-pink-100 text-pink-700 border-pink-200",
  Son: "bg-blue-100 text-blue-700 border-blue-200",
  Daughter: "bg-purple-100 text-purple-700 border-purple-200",
  Father: "bg-amber-100 text-amber-800 border-amber-200",
  Mother: "bg-orange-100 text-orange-800 border-orange-200",
  Brother: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Sister: "bg-rose-100 text-rose-700 border-rose-200",
  "Daughter-in-Law": "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  "Son-in-Law": "bg-indigo-100 text-indigo-700 border-indigo-200",
  Grandfather: "bg-amber-100 text-amber-900 border-amber-300",
  Grandmother: "bg-yellow-100 text-yellow-900 border-yellow-300",
  Grandchild: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Relative: "bg-teal-100 text-teal-700 border-teal-200",
  Other: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function ManageFamilyMembers() {
  const { residents = [] } = useResidents();
  const { activeBlocks = [] } = useBlockFlat();
  const { user } = useAuth();

  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  // Filters & View Mode
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState("all");
  const [relationFilter, setRelationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [copiedPhone, setCopiedPhone] = useState(null);

  // Delete State
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset Password State
  const [resetTarget, setResetTarget] = useState(null);
  const [customPassword, setCustomPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState("");
  const [copiedReset, setCopiedReset] = useState(false);

  // Block / Suspend State
  const [blockTarget, setBlockTarget] = useState(null);
  const [blockModalType, setBlockModalType] = useState("temporary");
  const [blockModalDays, setBlockModalDays] = useState(3);
  const [blockModalReason, setBlockModalReason] = useState("Access Under Review");
  const [blockModalDetails, setBlockModalDetails] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setFamilyMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeAllFamilyMembers((data) => {
      setFamilyMembers(data || []);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Lookup parent resident info
  function getParentResident(parentId) {
    if (!parentId) return null;
    return residents.find((r) => r.id === parentId);
  }

  function getParentInfo(parentId, fallbackFlat, fallbackBlock) {
    const r = getParentResident(parentId);
    if (r) {
      const rName = r.owner || r.name || "Resident";
      const rFlat = r.flat || r.flatNumber || fallbackFlat;
      const rBlock = r.block || fallbackBlock;
      return `${rName} (Flat ${rFlat}${rBlock ? `, ${rBlock}` : ""})`;
    }
    if (fallbackFlat) {
      return `Flat ${fallbackFlat}${fallbackBlock ? `, ${fallbackBlock}` : ""}`;
    }
    return "Not Linked";
  }

  // Copy phone handler
  function handleCopyPhone(phone) {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success("Phone copied to clipboard!");
    setTimeout(() => setCopiedPhone(null), 2000);
  }

  // Filtered members list
  const filtered = useMemo(() => {
    return familyMembers.filter((fm) => {
      const parent = getParentResident(fm.parentResidentId);

      // Search match
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchName = fm.name?.toLowerCase().includes(s);
        const matchEmail = fm.email?.toLowerCase().includes(s);
        const matchPhone = fm.phone?.includes(s);
        const matchFlat = fm.flat?.toLowerCase().includes(s);
        const matchBlock = fm.block?.toLowerCase().includes(s);
        const matchRelation = fm.relation?.toLowerCase().includes(s);
        const matchParent = parent?.owner?.toLowerCase().includes(s);
        if (!matchName && !matchEmail && !matchPhone && !matchFlat && !matchBlock && !matchRelation && !matchParent) {
          return false;
        }
      }

      // Block filter
      if (blockFilter !== "all") {
        const fmBlock = fm.block || parent?.block || "";
        if (fmBlock !== blockFilter) return false;
      }

      // Relation filter
      if (relationFilter !== "all") {
        if (fm.relation !== relationFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const isBlocked = fm.isBlocked || fm.status === "blocked" || fm.status === "suspended";
        if (statusFilter === "active" && isBlocked) return false;
        if (statusFilter === "blocked" && !isBlocked) return false;
      }

      return true;
    });
  }, [familyMembers, search, blockFilter, relationFilter, statusFilter, residents]);

  // Distinct relations for filter dropdown
  const uniqueRelations = useMemo(() => {
    const set = new Set();
    familyMembers.forEach((fm) => {
      if (fm.relation) set.add(fm.relation);
    });
    return Array.from(set).sort();
  }, [familyMembers]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = familyMembers.length;
    let active = 0;
    let blocked = 0;
    const flats = new Set();

    familyMembers.forEach((fm) => {
      const isBlocked = fm.isBlocked || fm.status === "blocked" || fm.status === "suspended";
      if (isBlocked) {
        blocked++;
      } else {
        active++;
      }
      if (fm.flat) flats.add(fm.flat);
    });

    return {
      total,
      active,
      blocked,
      flatsCovered: flats.size,
    };
  }, [familyMembers]);

  // Save handler (Add or Update)
  async function handleSaveFamilyMember(formData) {
    if (editingMember) {
      // Update existing
      const updates = {
        name: formData.name,
        relation: formData.relation,
        flat: formData.parentFlat,
        block: formData.parentBlock,
        parentResidentId: formData.parentResidentId,
        gender: formData.gender,
        age: formData.age,
        phone: formData.phone,
        email: formData.email,
        emergencyContact: formData.emergencyContact,
        mustChangePassword: formData.mustChangePassword,
      };

      await updateFamilyMemberAccount(editingMember.id, updates);

      // If a new password was provided in edit mode, trigger reset function
      if (formData.password) {
        try {
          await adminResetPasswordFn({
            targetUid: editingMember.id,
            password: formData.password,
          });
        } catch (pwErr) {
          console.warn("Could not update auth password directly:", pwErr.message);
        }
      }

      toast.success(`Family member "${formData.name}" updated successfully!`);
    } else {
      // Add new
      await addFamilyMemberAccount({
        parentResidentId: formData.parentResidentId,
        parentFlat: formData.parentFlat,
        parentBlock: formData.parentBlock,
        name: formData.name,
        relation: formData.relation,
        gender: formData.gender,
        age: formData.age,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        emergencyContact: formData.emergencyContact,
        mustChangePassword: formData.mustChangePassword,
      });

      toast.success(`Family member account created for "${formData.name}"!`);
    }

    setDrawerOpen(false);
    setEditingMember(null);
  }

  // Delete handler
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      const results = await deleteUserAccount({
        userId: confirmDelete.id,
        userName: confirmDelete.name,
        userEmail: confirmDelete.email || "",
        userPhone: confirmDelete.phone || confirmDelete.mobile || "",
        userRole: "family",
        userFlat: confirmDelete.flat || "",
        userBlock: confirmDelete.block || "",
        deletionReason: "Family member removed by admin",
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
        registeredAt: confirmDelete.createdAt || null,
        approvedAt: confirmDelete.createdAt || null,
      });

      if (results.authDeleted) {
        toast.success("Family member permanently deleted — registered phone & login details removed from Firebase");
      } else {
        toast.success("Family member record removed successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to remove account");
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(null);
    }
  }

  // Open reset password modal
  function handleOpenResetPassword(member) {
    setResetTarget(member);
    setCustomPassword("");
    setTempPasswordResult("");
    setCopiedReset(false);
  }

  // Confirm password reset
  async function handleConfirmResetPassword(e) {
    e.preventDefault();
    if (!resetTarget) return;

    if (customPassword && customPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setResetLoading(true);
    try {
      const chosenPassword =
        customPassword || "RWA@" + Math.floor(100000 + Math.random() * 900000);

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

      // Mark mustChangePassword in firestore
      await updateDoc(doc(db, "users", resetTarget.id), {
        mustChangePassword: true,
        tempPasswordSetAt: serverTimestamp(),
      });

      setTempPasswordResult(chosenPassword);
      toast.success("Temporary password generated!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  function handleCopyTempPassword() {
    if (!tempPasswordResult) return;
    navigator.clipboard.writeText(tempPasswordResult);
    setCopiedReset(true);
    toast.success("Password copied!");
    setTimeout(() => setCopiedReset(false), 2000);
  }

  // Open block modal
  function handleOpenBlock(member) {
    setBlockTarget(member);
    setBlockModalType("temporary");
    setBlockModalDays(3);
    setBlockModalReason("Access Under Review");
    setBlockModalDetails("");
  }

  // Confirm block / unblock
  async function handleConfirmBlockMember(e) {
    e.preventDefault();
    if (!blockTarget) return;

    const targetPhone = blockTarget.phone || blockTarget.mobile;
    if (!targetPhone) {
      toast.error("Family member has no registered phone number to enforce block");
      return;
    }

    setBlockLoading(true);
    try {
      const isCurrentlyBlocked =
        blockTarget.isBlocked ||
        blockTarget.status?.toLowerCase() === "blocked" ||
        blockTarget.status?.toLowerCase() === "suspended";

      if (isCurrentlyBlocked) {
        await unblockAccount(targetPhone, user);
        toast.success(`Access restored for ${blockTarget.name}`);
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
          mobile: targetPhone,
          userId: blockTarget.id,
          name: blockTarget.name,
          role: "family",
          blockType: blockModalType,
          blockedUntil,
          reason: fullReason,
          adminUser: user,
        });

        toast.success(
          `Successfully ${blockModalType === "temporary" ? "suspended" : "blocked"} ${blockTarget.name}`
        );
      }
      setBlockTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Action failed");
    } finally {
      setBlockLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Family Members
            </h1>
            <span className="bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-sky-200">
              {familyMembers.length} Registered
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Manage family member accounts, resident portal logins, and permissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingMember(null);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-md hover:shadow-lg transform active:scale-95"
          >
            <FaPlus className="text-sm" /> Add Family Member
          </button>
        </div>
      </div>

      {/* 2. Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-sky-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
              <FaUsers className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs font-medium text-gray-500">Total Family Members</p>
            </div>
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-emerald-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <FaUserCheck className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-xs font-medium text-gray-500">Active Portal Accounts</p>
            </div>
          </div>
        </div>

        {/* Card 3: Flats */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-indigo-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <FaHome className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.flatsCovered}</p>
              <p className="text-xs font-medium text-gray-500">Flats with Members</p>
            </div>
          </div>
        </div>

        {/* Card 4: Suspended / Blocked */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-amber-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <FaBan className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.blocked}</p>
              <p className="text-xs font-medium text-gray-500">Suspended / Blocked</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search member, phone, flat, block, relation, parent resident..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filters & View Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Block Filter */}
            {activeBlocks.length > 0 && (
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Blocks</option>
                {activeBlocks.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Relation Filter */}
            {uniqueRelations.length > 0 && (
              <select
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Relations</option>
                {uniqueRelations.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="blocked">Suspended / Blocked</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`p-2 rounded-lg text-sm transition ${
                  viewMode === "grid"
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FaThLarge />
              </button>
              <button
                onClick={() => setViewMode("table")}
                title="Table View"
                className={`p-2 rounded-lg text-sm transition ${
                  viewMode === "table"
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FaList />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Summary / Active Chips */}
        {(search || blockFilter !== "all" || relationFilter !== "all" || statusFilter !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Showing <strong className="text-gray-800">{filtered.length}</strong> of{" "}
              <strong>{familyMembers.length}</strong> members
            </span>
            <button
              onClick={() => {
                setSearch("");
                setBlockFilter("all");
                setRelationFilter("all");
                setStatusFilter("all");
              }}
              className="text-emerald-600 hover:text-emerald-700 font-semibold underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Content: Empty State OR Grid/Table List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-4 text-3xl">
            <FaUsers />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {familyMembers.length === 0
              ? "No Family Members Added Yet"
              : "No Matching Family Members"}
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
            {familyMembers.length === 0
              ? "Add family member accounts to give residents' family members their own portal login to view notices, bills, and raise complaints."
              : "Try adjusting your search criteria or clear your active filters to see all family members."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            {familyMembers.length === 0 ? (
              <button
                onClick={() => {
                  setEditingMember(null);
                  setDrawerOpen(true);
                }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow transition"
              >
                <FaPlus /> Add First Family Member
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch("");
                  setBlockFilter("all");
                  setRelationFilter("all");
                  setStatusFilter("all");
                }}
                className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((fm) => {
            const isBlocked =
              fm.isBlocked ||
              fm.status === "blocked" ||
              fm.status === "suspended";
            const relBadgeClass =
              RELATION_BADGES[fm.relation] ||
              "bg-slate-100 text-slate-700 border-slate-200";

            return (
              <div
                key={fm.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group"
              >
                {/* Top Accent Strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isBlocked
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-sky-500 to-emerald-500"
                  }`}
                />

                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-100 to-indigo-100 text-sky-700 flex items-center justify-center shrink-0 font-bold shadow-inner">
                        {fm.name ? fm.name.charAt(0).toUpperCase() : <FaUser />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate text-base leading-tight">
                          {fm.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${relBadgeClass}`}
                          >
                            {fm.relation || "Family"}
                          </span>
                          {fm.emergencyContact && (
                            <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                              SOS Contact
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          <FaBan className="text-[10px]" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <FaCheckCircle className="text-[10px]" /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="mt-4 space-y-2 text-xs text-gray-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                    {/* Flat & Block */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Flat / Unit:</span>
                      <span className="font-semibold text-gray-800 flex items-center gap-1">
                        <FaHome className="text-emerald-500" />
                        {fm.flat || "—"} {fm.block ? `(${fm.block})` : ""}
                      </span>
                    </div>

                    {/* Parent Resident */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Parent Resident:</span>
                      <span
                        className="font-medium text-gray-700 truncate max-w-[160px]"
                        title={getParentInfo(fm.parentResidentId, fm.flat, fm.block)}
                      >
                        {getParentInfo(fm.parentResidentId, fm.flat, fm.block)}
                      </span>
                    </div>

                    {/* Mobile Login */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Mobile (Login):</span>
                      {fm.phone ? (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(fm.phone)}
                          className="font-mono font-medium text-gray-800 hover:text-emerald-600 flex items-center gap-1 group/phone"
                          title="Click to copy mobile number"
                        >
                          <FaPhone className="text-green-500 text-[10px]" />
                          <span>{fm.phone}</span>
                          {copiedPhone === fm.phone ? (
                            <FaCheck className="text-emerald-600 text-[10px]" />
                          ) : (
                            <FaCopy className="text-gray-400 text-[10px] opacity-0 group-hover/phone:opacity-100 transition" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>

                    {/* Email */}
                    {fm.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-medium">Email:</span>
                        <span
                          className="text-gray-700 truncate max-w-[160px]"
                          title={fm.email}
                        >
                          {fm.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {/* Edit Button */}
                    <button
                      onClick={() => {
                        setEditingMember(fm);
                        setDrawerOpen(true);
                      }}
                      className="p-2 rounded-lg text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                      title="Edit Family Member"
                    >
                      <FaEdit className="text-sm" />
                    </button>

                    {/* Reset Password */}
                    <button
                      onClick={() => handleOpenResetPassword(fm)}
                      className="p-2 rounded-lg text-gray-600 hover:text-sky-700 hover:bg-sky-50 transition"
                      title="Reset Password"
                    >
                      <FaKey className="text-sm" />
                    </button>

                    {/* Block / Suspend */}
                    <button
                      onClick={() => handleOpenBlock(fm)}
                      className={`p-2 rounded-lg transition ${
                        isBlocked
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-amber-600 hover:bg-amber-50"
                      }`}
                      title={isBlocked ? "Unblock Account" : "Suspend Account"}
                    >
                      {isBlocked ? <FaUnlock className="text-sm" /> : <FaBan className="text-sm" />}
                    </button>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => setConfirmDelete(fm)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Remove Member"
                  >
                    <FaTrash className="text-sm" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Member Name</th>
                  <th className="py-3.5 px-4">Relation</th>
                  <th className="py-3.5 px-4">Flat / Unit</th>
                  <th className="py-3.5 px-4">Parent Resident</th>
                  <th className="py-3.5 px-4">Mobile (Login)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((fm) => {
                  const isBlocked =
                    fm.isBlocked ||
                    fm.status === "blocked" ||
                    fm.status === "suspended";
                  const relBadgeClass =
                    RELATION_BADGES[fm.relation] ||
                    "bg-slate-100 text-slate-700 border-slate-200";

                  return (
                    <tr key={fm.id} className="hover:bg-slate-50/60 transition">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {fm.name ? fm.name.charAt(0).toUpperCase() : "M"}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{fm.name}</p>
                            {fm.email && (
                              <p className="text-xs text-gray-400">{fm.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Relation */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${relBadgeClass}`}
                        >
                          {fm.relation || "Family"}
                        </span>
                      </td>

                      {/* Flat */}
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {fm.flat || "—"}{" "}
                        {fm.block && (
                          <span className="text-xs text-gray-500 font-normal">
                            ({fm.block})
                          </span>
                        )}
                      </td>

                      {/* Parent Resident */}
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {getParentInfo(fm.parentResidentId, fm.flat, fm.block)}
                      </td>

                      {/* Mobile */}
                      <td className="py-3 px-4 font-mono text-xs text-gray-800">
                        {fm.phone ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(fm.phone)}
                            className="flex items-center gap-1 hover:text-emerald-600"
                            title="Copy Phone"
                          >
                            <span>{fm.phone}</span>
                            {copiedPhone === fm.phone ? (
                              <FaCheck className="text-emerald-600 text-[10px]" />
                            ) : (
                              <FaCopy className="text-gray-400 text-[10px]" />
                            )}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingMember(fm);
                              setDrawerOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleOpenResetPassword(fm)}
                            className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                            title="Reset Password"
                          >
                            <FaKey />
                          </button>
                          <button
                            onClick={() => handleOpenBlock(fm)}
                            className={`p-1.5 rounded-lg transition ${
                              isBlocked
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-amber-600 hover:bg-amber-50"
                            }`}
                            title={isBlocked ? "Unblock" : "Suspend"}
                          >
                            {isBlocked ? <FaUnlock /> : <FaBan />}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(fm)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Add / Edit Family Member Drawer */}
      <AddFamilyMemberDrawer
        open={drawerOpen}
        familyMember={editingMember}
        onClose={() => {
          setDrawerOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveFamilyMember}
      />

      {/* 6. Direct Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-sky-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-lg">
                  <FaKey />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Reset Password</h3>
                  <p className="text-xs text-gray-500">For {resetTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setResetTarget(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FaTimes />
              </button>
            </div>

            {tempPasswordResult ? (
              <div className="p-6 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <FaCheckCircle className="text-emerald-500 text-3xl mx-auto" />
                  <p className="text-sm font-semibold text-emerald-900">
                    Password Reset Successfully!
                  </p>
                  <p className="text-xs text-emerald-700">
                    Share this new temporary password with <strong>{resetTarget.name}</strong>.
                  </p>
                  <div className="mt-2 p-3 bg-white border border-emerald-300 rounded-lg flex items-center justify-between font-mono text-base font-bold text-gray-800">
                    <span>{tempPasswordResult}</span>
                    <button
                      type="button"
                      onClick={handleCopyTempPassword}
                      className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 flex items-center gap-1 transition"
                    >
                      {copiedReset ? <FaCheck /> : <FaCopy />}
                      <span>{copiedReset ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="p-6 space-y-4">
                <p className="text-xs text-gray-500">
                  You can provide a custom password below, or leave it blank to automatically generate a secure temporary password.
                </p>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Custom Password (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank to auto-generate"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                    minLength={6}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetTarget(null)}
                    disabled={resetLoading}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-5 py-2 text-sm font-semibold bg-sky-600 hover:bg-sky-700 disabled:bg-gray-400 text-white rounded-xl transition flex items-center gap-2"
                  >
                    {resetLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 7. Suspend / Block Modal */}
      {blockTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                  <FaBan />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {blockTarget.isBlocked ||
                    blockTarget.status === "blocked" ||
                    blockTarget.status === "suspended"
                      ? "Restore Account Access"
                      : "Suspend / Block Account"}
                  </h3>
                  <p className="text-xs text-gray-500">{blockTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setBlockTarget(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleConfirmBlockMember} className="p-6 space-y-4">
              {blockTarget.isBlocked ||
              blockTarget.status === "blocked" ||
              blockTarget.status === "suspended" ? (
                <p className="text-sm text-gray-600">
                  Are you sure you want to unblock <strong>{blockTarget.name}</strong>? They will regain access to log into the resident portal immediately.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Restriction Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBlockModalType("temporary")}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          blockModalType === "temporary"
                            ? "border-amber-500 bg-amber-50 text-amber-800"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Temporary Suspension
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockModalType("permanent")}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                          blockModalType === "permanent"
                            ? "border-red-500 bg-red-50 text-red-800"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Permanent Block
                      </button>
                    </div>
                  </div>

                  {blockModalType === "temporary" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Suspension Duration (Days)
                      </label>
                      <select
                        value={blockModalDays}
                        onChange={(e) => setBlockModalDays(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="1">1 Day</option>
                        <option value="3">3 Days</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={blockModalReason}
                      onChange={(e) => setBlockModalReason(e.target.value)}
                      placeholder="e.g. Disciplinary, pending verification"
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setBlockTarget(null)}
                  disabled={blockLoading}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className={`px-5 py-2 text-sm font-semibold rounded-xl text-white transition ${
                    blockTarget.isBlocked ||
                    blockTarget.status === "blocked" ||
                    blockTarget.status === "suspended"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : blockModalType === "temporary"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {blockLoading
                    ? "Processing..."
                    : blockTarget.isBlocked ||
                      blockTarget.status === "blocked" ||
                      blockTarget.status === "suspended"
                    ? "Restore Access"
                    : blockModalType === "temporary"
                    ? "Suspend Account"
                    : "Block Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Remove Family Member Account"
          message={`Are you sure you want to delete "${confirmDelete.name}"? They will permanently lose access to the portal.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
