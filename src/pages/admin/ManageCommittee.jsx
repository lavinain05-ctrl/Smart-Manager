import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaUsers,
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaPhone,
  FaEnvelope,
  FaClock,
  FaUser,
  FaKey,
  FaCopy,
  FaCheck,
  FaCheckCircle,
  FaBuilding,
  FaDoorOpen,
  FaBan,
  FaUnlock,
  FaThLarge,
  FaList,
  FaCrown,
  FaUserShield,
  FaShieldAlt,
  FaMoneyBillWave,
  FaUserPlus,
  FaUserTie,
  FaCamera,
  FaLink,
  FaChartBar,
  FaTrashAlt,
  FaHandHoldingHeart,
} from "react-icons/fa";

import toast from "react-hot-toast";
import { useCommittee } from "../../context/CommitteeContext";
import { useAuth } from "../../context/AuthContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { deleteUserAccount } from "../../services/accountDeletionService";
import { normalizeMobile, mobileToAuthEmail, writeAuthLookup, isRealEmail } from "../../services/authService";
import { adminResetPasswordFn, db, secondaryAuth } from "../../firebase/firebase";
import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { blockAccount, unblockAccount } from "../../services/blockService";
import { terminateAllOtherSessions } from "../../services/sessionService";
import {
  toggleCommitteeGarbagePower,
  toggleCommitteeSpecialPower,
  toggleCommitteeCollectionPower,
  toggleCommitteeReportAccess,
} from "../../services/committeeService";
import AddCommitteeDrawer from "../../components/forms/AddCommitteeDrawer";

const DESIGNATIONS = [
  "President",
  "Vice President",
  "Secretary",
  "Vice Secretary",
  "Joint Secretary",
  "Treasurer",
  "Vice Treasurer",
  "General Secretary",
  "Spokesperson",
  "Advisor",
  "Legal Advisor",
  "Technical Advisor",
  "Cultural Secretary",
  "Sports Secretary",
  "Security Incharge",
  "Maintenance Incharge",
  "Executive Member",
  "Member",
];

const designationColors = {
  President: "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Vice President": "bg-indigo-100 text-indigo-700 border-indigo-200",
  Secretary: "bg-purple-100 text-purple-800 border-purple-200",
  "Vice Secretary": "bg-purple-100 text-purple-700 border-purple-200",
  "Joint Secretary": "bg-purple-100 text-purple-700 border-purple-200",
  "General Secretary": "bg-indigo-100 text-indigo-800 border-indigo-200",
  Treasurer: "bg-amber-100 text-amber-800 border-amber-200",
  "Vice Treasurer": "bg-amber-100 text-amber-700 border-amber-200",
  Spokesperson: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Advisor: "bg-blue-100 text-blue-800 border-blue-200",
  "Executive Member": "bg-slate-100 text-slate-700 border-slate-200",
};

export function getAdminMemberPhoto(member) {
  if (member?.profilePhotoUrl) return member.profilePhotoUrl;
  const isPresident =
    member?.designation?.toLowerCase() === "president" ||
    member?.name?.toLowerCase().includes("dharmendra");
  if (isPresident) return "/committee/president.jpg";
  const isVicePresident =
    member?.designation?.toLowerCase() === "vice president" ||
    member?.name?.toLowerCase().includes("ankit");
  if (isVicePresident) return "/committee/ankit-chaudhary.png";
  const isSecretary =
    member?.designation?.toLowerCase() === "secretary" ||
    member?.name?.toLowerCase().includes("janardan") ||
    member?.name?.toLowerCase().includes("janardhan");
  if (isSecretary) return "/committee/secretary.jpg";
  const isTreasurer =
    member?.designation?.toLowerCase() === "treasurer" ||
    member?.name?.toLowerCase().includes("sandeep") ||
    member?.name?.toLowerCase().includes("gaur");
  if (isTreasurer) return "/committee/treasurer.jpg";
  const isVinod =
    member?.designation?.toLowerCase() === "vice treasurer" ||
    member?.name?.toLowerCase().includes("vinod");
  if (isVinod) return "/committee/vinod-kumar.jpg";
  const isNarendra =
    member?.designation?.toLowerCase() === "spokesperson" ||
    member?.name?.toLowerCase().includes("narendra") ||
    member?.name?.toLowerCase().includes("dhama");
  if (isNarendra) return "/committee/narendra-dhama.png";
  const isDinesh =
    member?.designation?.toLowerCase() === "advisor" ||
    member?.name?.toLowerCase().includes("dinesh");
  if (isDinesh) return "/committee/dinesh-kumar.png";
  const isManoj =
    member?.designation?.toLowerCase() === "vice secretary" ||
    member?.name?.toLowerCase().includes("manoj") ||
    member?.name?.toLowerCase().includes("tomar");
  if (isManoj) return "/committee/manoj-tomar.jpg";
  const isPandey =
    member?.name?.toLowerCase().includes("pandey") ||
    member?.name?.toLowerCase().includes("d k") ||
    member?.name?.toLowerCase().includes("dk");
  if (isPandey) return "/committee/dk-pandey.jpg";
  return null;
}

export default function ManageCommittee() {
  const {
    committee = [],
    addCommitteeMember,
    updateCommitteeMember,
    removeCommitteeMember,
    uploadCommitteePhoto,
    deleteCommitteePhoto,
    replaceCommitteePhoto,
    setCommitteePhotoUrl,
  } = useCommittee();
  const { user } = useAuth();
  const { activeBlocks = [] } = useBlockFlat();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  // Quick Photo Edit State
  const [photoTarget, setPhotoTarget] = useState(null);
  const [photoModalMode, setPhotoModalMode] = useState("file"); // "file" | "url"
  const [photoModalUrl, setPhotoModalUrl] = useState("");
  const [photoModalFile, setPhotoModalFile] = useState(null);
  const [photoModalPreview, setPhotoModalPreview] = useState("");
  const [photoModalLoading, setPhotoModalLoading] = useState(false);

  // Filters & View Mode
  const [search, setSearch] = useState("");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [copiedPhone, setCopiedPhone] = useState(null);

  // Delete state
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
  const [blockModalReason, setBlockModalReason] = useState("Governance / Disciplinary Review");
  const [blockModalDetails, setBlockModalDetails] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  function handleOpenPhotoModal(member) {
    setPhotoTarget(member);
    setPhotoModalUrl(member.profilePhotoUrl || "");
    setPhotoModalPreview(member.profilePhotoUrl || "");
    setPhotoModalFile(null);
    setPhotoModalMode(member.profilePhotoUrl ? "url" : "file");
  }

  async function handleSavePhotoModal(e) {
    e.preventDefault();
    if (!photoTarget) return;
    setPhotoModalLoading(true);
    const memberId = photoTarget.id || photoTarget.uid;

    try {
      if (photoModalMode === "file") {
        if (photoModalFile) {
          await replaceCommitteePhoto(memberId, photoModalFile);
        } else if (!photoModalPreview) {
          await deleteCommitteePhoto(memberId);
        }
      } else {
        const cleanUrl = photoModalUrl.trim();
        if (cleanUrl) {
          await setCommitteePhotoUrl(memberId, cleanUrl);
        } else {
          await deleteCommitteePhoto(memberId);
        }
      }
      setPhotoTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update profile photo");
    } finally {
      setPhotoModalLoading(false);
    }
  }

  // Copy phone handler
  function handleCopyPhone(phone) {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success("Phone copied to clipboard!");
    setTimeout(() => setCopiedPhone(null), 2000);
  }

  // Quick toggle committee garbage collection power
  async function handleToggleGarbagePower(member) {
    const current = Boolean(member.permissions?.canCollectGarbage || member.canCollectGarbage);
    const next = !current;
    try {
      await toggleCommitteeGarbagePower(member.id || member.uid, next);
      toast.success(
        next
          ? `Granted Garbage Collection power to ${member.name}!`
          : `Revoked Garbage Collection power from ${member.name}.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update garbage collection permissions");
    }
  }

  // Quick toggle committee special collection power
  async function handleToggleSpecialPower(member) {
    const current = Boolean(member.permissions?.canCollectSpecial || member.canCollectSpecial);
    const next = !current;
    try {
      await toggleCommitteeSpecialPower(member.id || member.uid, next);
      toast.success(
        next
          ? `Granted Special Collection power to ${member.name}!`
          : `Revoked Special Collection power from ${member.name}.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update special collection permissions");
    }
  }

  // Backwards-compatible alias
  const handleToggleCollectionPower = handleToggleGarbagePower;

  // Quick toggle committee society report viewing power
  async function handleToggleReportPower(member) {
    const current = Boolean(member.permissions?.canViewGarbageReports || member.canViewGarbageReports);
    const next = !current;
    try {
      await toggleCommitteeReportAccess(member.id || member.uid, next);
      toast.success(
        next
          ? `Granted Society Reports & Analytics access to ${member.name}!`
          : `Revoked Society Reports & Analytics access from ${member.name}.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update report permissions");
    }
  }

  // Filtered members list
  const filtered = useMemo(() => {
    return committee.filter((m) => {
      // Search
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchName = m.name?.toLowerCase().includes(s);
        const matchDesig = m.designation?.toLowerCase().includes(s);
        const matchEmail = m.email?.toLowerCase().includes(s);
        const matchPhone = m.phone?.includes(s);
        const matchFlat = m.flat?.toLowerCase().includes(s);
        const matchBlock = m.block?.toLowerCase().includes(s);
        if (!matchName && !matchDesig && !matchEmail && !matchPhone && !matchFlat && !matchBlock) {
          return false;
        }
      }

      // Designation filter
      if (designationFilter !== "all") {
        if (m.designation !== designationFilter) return false;
      }

      // Block filter
      if (blockFilter !== "all") {
        if (m.block !== blockFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const isBlocked = m.isBlocked || m.status === "blocked" || m.status === "suspended";
        if (statusFilter === "active" && isBlocked) return false;
        if (statusFilter === "blocked" && !isBlocked) return false;
      }

      return true;
    });
  }, [committee, search, designationFilter, blockFilter, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = committee.length;
    let executiveCount = 0;
    let active = 0;
    let blocked = 0;

    committee.forEach((m) => {
      const isBlocked = m.isBlocked || m.status === "blocked" || m.status === "suspended";
      if (isBlocked) {
        blocked++;
      } else {
        active++;
      }

      const nonExecutiveRoles = ["Member", "General Member", "Volunteer"];
      const isExecutive = m.designation && !nonExecutiveRoles.includes(m.designation);
      if (isExecutive) {
        executiveCount++;
      }
    });

    return {
      total,
      executiveCount,
      active,
      blocked,
    };
  }, [committee]);

  // Save handler (Add or Edit)
  async function handleSaveMember(formData) {
    if (editingMember) {
      // Update existing
      const memberId = editingMember.id || editingMember.uid;
      const updates = {
        name: formData.name,
        designation: formData.designation,
        phone: formData.phone,
        email: formData.email,
        flat: formData.flat,
        block: formData.block,
        blockId: formData.blockId,
        residentId: formData.residentId,
        tenure: formData.tenure,
        introduction: formData.introduction,
        order: formData.order,
        permissions: formData.permissions,
        mustChangePassword: formData.mustChangePassword,
      };

      const success = await updateCommitteeMember(memberId, updates);
      if (!success) return;

      // Photo handling
      if (formData.removePhoto) {
        await deleteCommitteePhoto(memberId);
      } else if (formData.photoFile) {
        await replaceCommitteePhoto(memberId, formData.photoFile);
      } else if (formData.photoUrl !== undefined && formData.photoUrl !== "") {
        await setCommitteePhotoUrl(memberId, formData.photoUrl);
      }

      // Password update if provided
      if (formData.password) {
        let pwUpdated = false;
        try {
          await adminResetPasswordFn({
            targetUid: memberId,
            password: formData.password,
          });
          pwUpdated = true;
        } catch (pwErr) {
          console.warn("Could not update auth password directly:", pwErr.message);
        }

        if (!pwUpdated) {
          const cleanPhone = normalizeMobile(formData.phone || editingMember.phone || "");
          if (cleanPhone.length === 10) {
            try {
              const lookupDoc = await getDoc(doc(db, "authLookup", cleanPhone));
              if (!lookupDoc?.exists()) {
                const authEmail = mobileToAuthEmail(cleanPhone);
                const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, formData.password);
                const newUid = cred.user.uid;
                await signOut(secondaryAuth);
                await writeAuthLookup(cleanPhone, authEmail, newUid, formData.email || "", formData.flat || "", formData.name || "");
                await setDoc(doc(db, "users", newUid), { ...updates, role: "committee" }, { merge: true });
                await setDoc(doc(db, "committee", newUid), { ...updates, uid: newUid }, { merge: true });
              } else {
                await updateDoc(doc(db, "users", memberId), { mustChangePassword: true }).catch(() => {});
              }
            } catch (createErr) {
              console.warn("secondaryAuth check/creation on save:", createErr.message);
            }
          }
        }
      }
    } else {
      // Add new
      const createdUid = await addCommitteeMember({
        name: formData.name,
        designation: formData.designation,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        tenure: formData.tenure,
        introduction: formData.introduction,
        order: formData.order,
        flat: formData.flat,
        block: formData.block,
        blockId: formData.blockId,
        residentId: formData.residentId,
        permissions: formData.permissions,
        mustChangePassword: formData.mustChangePassword,
        profilePhotoUrl: formData.photoUrl || "",
      });

      if (!createdUid) return;

      // Upload photo if selected
      if (formData.photoFile && typeof createdUid === "string") {
        try {
          await uploadCommitteePhoto(createdUid, formData.photoFile);
        } catch (photoErr) {
          console.warn("Photo upload failed:", photoErr);
          toast.error(
            "Official account created, but photo upload failed: " +
              (photoErr.message || "Storage error")
          );
        }
      }
    }

    setDrawerOpen(false);
    setEditingMember(null);
  }

  // Delete handler
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    const memberId = confirmDelete.id || confirmDelete.uid;

    try {
      // 1. Delete account via accountDeletionService
      const results = await deleteUserAccount({
        userId: memberId,
        userName: confirmDelete.name,
        userEmail: confirmDelete.email || "",
        userPhone: confirmDelete.phone || confirmDelete.mobile || "",
        userRole: "committee",
        userFlat: confirmDelete.flat || "",
        userBlock: confirmDelete.block || "",
        deletionReason: "Removed from committee by admin",
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
        registeredAt: confirmDelete.createdAt || null,
        approvedAt: confirmDelete.createdAt || null,
      });

      // 2. Remove from committee collection & storage
      await removeCommitteeMember(memberId);

      if (results.authDeleted) {
        toast.success("Committee member permanently deleted — registered phone & login details removed from Firebase");
      } else {
        toast.success("Committee member removed successfully");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove committee member");
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
      const memberId = resetTarget.id || resetTarget.uid;
      const chosenPassword =
        customPassword || "RWA@" + Math.floor(100000 + Math.random() * 900000);

      let cloudSuccess = false;
      try {
        const result = await adminResetPasswordFn({
          targetUid: memberId,
          password: chosenPassword,
        });
        if (result?.data?.tempPassword) {
          cloudSuccess = true;
          setTempPasswordResult(result.data.tempPassword);
        }
      } catch (fnErr) {
        console.warn("Cloud function reset:", fnErr.message);
      }

      // If user had no Auth user, create it via secondaryAuth only if not already existing
      const targetPhone = normalizeMobile(resetTarget.phone || resetTarget.mobile || "");
      if (targetPhone.length === 10) {
        try {
          const lookupDoc = await getDoc(doc(db, "authLookup", targetPhone));
          if (!lookupDoc?.exists()) {
            const authEmail = mobileToAuthEmail(targetPhone);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, chosenPassword);
            const newUid = cred.user.uid;
            await signOut(secondaryAuth);
            console.log("[Committee] Reset created missing Auth user:", newUid);
            await writeAuthLookup(targetPhone, authEmail, newUid, resetTarget.email || "", resetTarget.flat || "", resetTarget.name || "");
            await setDoc(doc(db, "users", newUid), { ...resetTarget, role: "committee", mustChangePassword: true, passwordChangedAt: serverTimestamp() }, { merge: true });
            await setDoc(doc(db, "committee", newUid), { ...resetTarget, uid: newUid, mustChangePassword: true }, { merge: true });
          }
        } catch (createErr) {
          console.warn("[Committee] secondaryAuth creation on reset:", createErr.message);
        }
      }

      // Mark mustChangePassword and passwordChangedAt in Firestore
      try {
        await updateDoc(doc(db, "users", memberId), {
          mustChangePassword: true,
          tempPasswordSetAt: serverTimestamp(),
          passwordChangedAt: serverTimestamp(),
        });
      } catch {}
      try {
        await updateDoc(doc(db, "committee", memberId), {
          mustChangePassword: true,
        });
      } catch {}

      // Immediately revoke all other sessions across devices for this committee member
      try {
        await terminateAllOtherSessions(
          memberId,
          null,
          "Password was reset by administrator. Please log in with your temporary password."
        );
      } catch (sessErr) {
        console.warn("Failed to terminate committee sessions:", sessErr.message);
      }

      if (cloudSuccess) {
        toast.success("Password reset successfully! Other devices logged out.");
        return;
      }

      setTempPasswordResult(chosenPassword);
      toast.success("Temporary password generated! Other devices logged out.");
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
    setBlockModalReason("Governance / Disciplinary Review");
    setBlockModalDetails("");
  }

  // Confirm block / unblock
  async function handleConfirmBlockMember(e) {
    e.preventDefault();
    if (!blockTarget) return;

    const targetPhone = blockTarget.phone || blockTarget.mobile;
    if (!targetPhone) {
      toast.error("Committee member has no registered phone number to enforce block");
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
          userId: blockTarget.id || blockTarget.uid,
          name: blockTarget.name,
          role: "committee",
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
              RWA Committee
            </h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              {committee.length} Officials
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Manage committee executive members, designations, and administrative portal access
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/committee/dashboard"
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-xs"
          >
            <FaShieldAlt className="text-sm" /> Open Committee Portal
          </Link>

          <button
            onClick={() => {
              setEditingMember(null);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-md hover:shadow-lg transform active:scale-95 cursor-pointer"
          >
            <FaPlus className="text-sm" /> Add Member
          </button>
        </div>
      </div>

      {/* 2. Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-indigo-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <FaUsers className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs font-medium text-gray-500">Committee Officials</p>
            </div>
          </div>
        </div>

        {/* Card 2: Executive Leadership */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-purple-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
              <FaCrown className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.executiveCount}</p>
              <p className="text-xs font-medium text-gray-500">Executive Officers</p>
            </div>
          </div>
        </div>

        {/* Card 3: Active Logins */}
        <div className="bg-white rounded-2xl shadow-sm p-4.5 border border-slate-100 border-l-4 border-l-emerald-500 hover:shadow transition">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <FaCheckCircle className="text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-xs font-medium text-gray-500">Active Accounts</p>
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
              placeholder="Search by official name, designation, flat, block, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
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
            {/* Designation Filter */}
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Designations</option>
              {DESIGNATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Block Filter */}
            {activeBlocks.length > 0 && (
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Blocks</option>
                {activeBlocks.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
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
                    ? "bg-white text-indigo-600 shadow-sm"
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
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <FaList />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {(search || designationFilter !== "all" || blockFilter !== "all" || statusFilter !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Showing <strong className="text-gray-800">{filtered.length}</strong> of{" "}
              <strong>{committee.length}</strong> officials
            </span>
            <button
              onClick={() => {
                setSearch("");
                setDesignationFilter("all");
                setBlockFilter("all");
                setStatusFilter("all");
              }}
              className="text-indigo-600 hover:text-indigo-700 font-semibold underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Main Content: Empty State OR Grid/Table List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4 text-3xl">
            <FaUsers />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {committee.length === 0
              ? "No Committee Members Added Yet"
              : "No Matching Committee Members"}
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
            {committee.length === 0
              ? "Add RWA executive officers, president, secretary, and members to empower them to govern society notices and resident complaints."
              : "Try adjusting your search criteria or clear your active filters to see all committee members."}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            {committee.length === 0 ? (
              <button
                onClick={() => {
                  setEditingMember(null);
                  setDrawerOpen(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow transition"
              >
                <FaPlus /> Add First Committee Member
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch("");
                  setDesignationFilter("all");
                  setBlockFilter("all");
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
          {filtered.map((member) => {
            const isBlocked =
              member.isBlocked ||
              member.status === "blocked" ||
              member.status === "suspended";
            const desigClass =
              designationColors[member.designation] ||
              "bg-slate-100 text-slate-700 border-slate-200";

            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition flex flex-col justify-between relative overflow-hidden group"
              >
                {/* Top Accent Strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isBlocked
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                />

                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0 group/avatar" style={{ width: "56px", height: "56px" }}>
                        {(() => {
                          const photo = getAdminMemberPhoto(member);
                          return (
                            <>
                              {photo && (
                                <img
                                  src={photo}
                                  alt={member.name}
                                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-indigo-100 shadow-xs cursor-pointer hover:opacity-90 transition shrink-0"
                                  style={{ width: "56px", height: "56px", minWidth: "56px", minHeight: "56px", maxWidth: "56px", maxHeight: "56px" }}
                                  onClick={() => handleOpenPhotoModal(member)}
                                  title="Click to update photo"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const fallback = e.currentTarget.parentElement?.querySelector(".member-initial-fallback");
                                    if (fallback) fallback.style.display = "flex";
                                  }}
                                />
                              )}
                              <div
                                onClick={() => handleOpenPhotoModal(member)}
                                className={`member-initial-fallback w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 items-center justify-center shrink-0 font-bold text-base shadow-inner cursor-pointer hover:bg-indigo-200/80 transition ${photo ? "hidden" : "flex"}`}
                                style={{ width: "56px", height: "56px", minWidth: "56px", minHeight: "56px" }}
                                title="Click to set photo"
                              >
                                {member.name ? member.name.charAt(0).toUpperCase() : <FaUser />}
                              </div>
                            </>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => handleOpenPhotoModal(member)}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-[10px] shadow-sm transition"
                          title="Quick Set / Change Photo"
                        >
                          <FaCamera />
                        </button>
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate text-base leading-tight">
                          {member.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${desigClass}`}
                          >
                            🏛️ {member.designation || "Member"}
                          </span>
                          {member.tenure && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                              <FaClock className="text-[9px]" /> {member.tenure}
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
                        <FaDoorOpen className="text-emerald-500" />
                        {member.flat || "—"} {member.block ? `(${member.block})` : ""}
                      </span>
                    </div>

                    {/* Mobile Login */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Phone (Login ID):</span>
                      {member.phone ? (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(member.phone)}
                          className="font-mono font-medium text-gray-800 hover:text-indigo-600 flex items-center gap-1 group/phone"
                          title="Click to copy mobile number"
                        >
                          <FaPhone className="text-green-500 text-[10px]" />
                          <span>{member.phone}</span>
                          {copiedPhone === member.phone ? (
                            <FaCheck className="text-indigo-600 text-[10px]" />
                          ) : (
                            <FaCopy className="text-gray-400 text-[10px] opacity-0 group-hover/phone:opacity-100 transition" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>

                    {/* Email */}
                    {isRealEmail(member.email) && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-medium">Official Email:</span>
                        <span
                          className="text-gray-700 truncate max-w-[160px]"
                          title={member.email}
                        >
                          {member.email}
                        </span>
                      </div>
                    )}

                    {/* Introduction / Bio */}
                    {member.introduction && (
                      <p className="text-[11px] text-gray-500 italic pt-1 border-t border-slate-200/60 line-clamp-2">
                        "{member.introduction}"
                      </p>
                    )}

                    {/* Delegated Powers Badges */}
                    {member.permissions && Object.values(member.permissions).some(Boolean) && (
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider w-full block">
                          Delegated Powers:
                        </span>
                        {member.permissions.canManageResidents && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[10px] border border-indigo-100 flex items-center gap-1">
                            <FaUsers className="text-[9px]" /> Residents
                          </span>
                        )}
                        {member.permissions.canManageCollectors && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[10px] border border-indigo-100 flex items-center gap-1">
                            <FaUserTie className="text-[9px]" /> Collectors
                          </span>
                        )}
                        {member.permissions.canManageRegistrations && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-100 flex items-center gap-1">
                            <FaUserPlus className="text-[9px]" /> Registrations
                          </span>
                        )}
                        {member.permissions.canManageProfileRequests && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-[10px] border border-purple-100 flex items-center gap-1">
                            <FaEdit className="text-[9px]" /> Profile Req
                          </span>
                        )}
                        {member.permissions.canManageAccountRecovery && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-100 flex items-center gap-1">
                            <FaKey className="text-[9px]" /> Recovery
                          </span>
                        )}
                        {(member.permissions?.canCollectGarbage || member.canCollectGarbage) && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1 shadow-xs">
                            <FaTrashAlt className="text-[9px]" /> GC Collector
                          </span>
                        )}
                        {(member.permissions?.canCollectSpecial || member.canCollectSpecial) && (
                          <span
                            className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[10px] border border-indigo-300 flex items-center gap-1 shadow-xs"
                            title={
                              (member.permissions?.specialCollectionScope || member.specialCollectionScope) === "specific"
                                ? `Permitted Campaigns: ${(member.permissions?.allowedSpecialCollectionNames || member.allowedSpecialCollectionNames || []).join(", ") || `${(member.permissions?.allowedSpecialCollections || member.allowedSpecialCollections || []).length} campaigns`}`
                                : "Authorized for All Special Collections"
                            }
                          >
                            <FaHandHoldingHeart className="text-[9px]" />{" "}
                            {(member.permissions?.specialCollectionScope || member.specialCollectionScope) === "specific"
                              ? `Special (${(member.permissions?.allowedSpecialCollections || member.allowedSpecialCollections || []).length})`
                              : "Special (All)"}
                          </span>
                        )}
                        {(member.permissions?.canViewGarbageReports || member.canViewGarbageReports) && (
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px] border border-teal-300 flex items-center gap-1 shadow-xs">
                            <FaChartBar className="text-[9px]" /> Reports Viewer
                          </span>
                        )}
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
                        setEditingMember(member);
                        setDrawerOpen(true);
                      }}
                      className="p-2 rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition"
                      title="Edit Official"
                    >
                      <FaEdit className="text-sm" />
                    </button>

                    {/* Reset Password */}
                    <button
                      onClick={() => handleOpenResetPassword(member)}
                      className="p-2 rounded-lg text-gray-600 hover:text-amber-700 hover:bg-amber-50 transition"
                      title="Reset Password"
                    >
                      <FaKey className="text-sm" />
                    </button>

                    {/* Block / Suspend */}
                    <button
                      onClick={() => handleOpenBlock(member)}
                      className={`p-2 rounded-lg transition ${
                        isBlocked
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-amber-600 hover:bg-amber-50"
                      }`}
                      title={isBlocked ? "Unblock Account" : "Suspend Account"}
                    >
                      {isBlocked ? <FaUnlock className="text-sm" /> : <FaBan className="text-sm" />}
                    </button>

                    {/* Quick Toggle GC Collection Power */}
                    <button
                      type="button"
                      onClick={() => handleToggleGarbagePower(member)}
                      className={`p-2 rounded-lg transition cursor-pointer ${
                        member.permissions?.canCollectGarbage || member.canCollectGarbage
                          ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          : "text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                      }`}
                      title={
                        member.permissions?.canCollectGarbage || member.canCollectGarbage
                          ? "Garbage Collection Power: ACTIVE (Click to Revoke)"
                          : "Garbage Collection Power: DISABLED (Click to Grant)"
                      }
                    >
                      <FaTrashAlt className="text-sm" />
                    </button>

                    {/* Quick Toggle Special Collection Power */}
                    <button
                      type="button"
                      onClick={() => handleToggleSpecialPower(member)}
                      className={`p-2 rounded-lg transition cursor-pointer ${
                        member.permissions?.canCollectSpecial || member.canCollectSpecial
                          ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                          : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                      }`}
                      title={
                        member.permissions?.canCollectSpecial || member.canCollectSpecial
                          ? "Special Collection Power: ACTIVE (Click to Revoke)"
                          : "Special Collection Power: DISABLED (Click to Grant)"
                      }
                    >
                      <FaHandHoldingHeart className="text-sm" />
                    </button>

                    {/* Quick Toggle Society Reports Power */}
                    <button
                      type="button"
                      onClick={() => handleToggleReportPower(member)}
                      className={`p-2 rounded-lg transition cursor-pointer ${
                        member.permissions?.canViewGarbageReports || member.canViewGarbageReports
                          ? "text-teal-700 bg-teal-50 hover:bg-teal-100"
                          : "text-slate-400 hover:text-teal-600 hover:bg-slate-100"
                      }`}
                      title={
                        member.permissions?.canViewGarbageReports || member.canViewGarbageReports
                          ? "Society Reports Power: ACTIVE (Click to Revoke)"
                          : "Society Reports Power: DISABLED (Click to Grant)"
                      }
                    >
                      <FaChartBar className="text-sm" />
                    </button>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => setConfirmDelete(member)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Remove Official"
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
                  <th className="py-3.5 px-4">Official Name</th>
                  <th className="py-3.5 px-4">Designation</th>
                  <th className="py-3.5 px-4">Flat / Unit</th>
                  <th className="py-3.5 px-4">Phone (Login ID)</th>
                  <th className="py-3.5 px-4">Tenure</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((member) => {
                  const isBlocked =
                    member.isBlocked ||
                    member.status === "blocked" ||
                    member.status === "suspended";
                  const desigClass =
                    designationColors[member.designation] ||
                    "bg-slate-100 text-slate-700 border-slate-200";

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60 transition">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoModal(member)}
                            className="relative group shrink-0"
                            title="Click to update photo"
                          >
                            {(() => {
                              const photo = getAdminMemberPhoto(member);
                              return (
                                <>
                                  {photo && (
                                    <img
                                      src={photo}
                                      alt={member.name}
                                      className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-indigo-100 group-hover:ring-indigo-400 transition"
                                      style={{ width: "32px", height: "32px", minWidth: "32px", minHeight: "32px", maxWidth: "32px", maxHeight: "32px" }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        const fallback = e.currentTarget.parentElement?.querySelector(".table-initial-fallback");
                                        if (fallback) fallback.style.display = "flex";
                                      }}
                                    />
                                  )}
                                  <div className={`table-initial-fallback w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-200 transition ${photo ? "hidden" : "flex"}`}>
                                    {member.name ? member.name.charAt(0).toUpperCase() : "C"}
                                  </div>
                                </>
                              );
                            })()}
                            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center text-white text-[9px] opacity-0 group-hover:opacity-100 transition">
                              <FaCamera />
                            </div>
                          </button>
                          <div>
                            <p className="font-semibold text-gray-900">{member.name}</p>
                            {isRealEmail(member.email) && (
                              <p className="text-xs text-gray-400">{member.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Designation */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${desigClass}`}
                        >
                          {member.designation || "Member"}
                        </span>
                        {member.permissions && Object.values(member.permissions).some(Boolean) && (
                          <div className="flex flex-wrap gap-1 mt-1.5 max-w-[200px]">
                            {member.permissions.canManageResidents && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-semibold border border-indigo-100">
                                Residents
                              </span>
                            )}
                            {member.permissions.canManageCollectors && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-semibold border border-indigo-100">
                                Collectors
                              </span>
                            )}
                            {member.permissions.canManageRegistrations && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold border border-emerald-100">
                                Registrations
                              </span>
                            )}
                            {member.permissions.canManageProfileRequests && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-semibold border border-purple-100">
                                Profile Req
                              </span>
                            )}
                            {member.permissions.canManageAccountRecovery && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold border border-amber-100">
                                Recovery
                              </span>
                            )}
                            {(member.permissions?.canCollectGarbage || member.canCollectGarbage) && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-300">
                                ♻️ GC
                              </span>
                            )}
                            {(member.permissions?.canCollectSpecial || member.canCollectSpecial) && (
                              <span
                                className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold border border-indigo-300"
                                title={
                                  (member.permissions?.specialCollectionScope || member.specialCollectionScope) === "specific"
                                    ? `Permitted Campaigns: ${(member.permissions?.allowedSpecialCollectionNames || member.allowedSpecialCollectionNames || []).join(", ") || `${(member.permissions?.allowedSpecialCollections || member.allowedSpecialCollections || []).length} campaigns`}`
                                    : "Authorized for All Special Collections"
                                }
                              >
                                🎁 Special{" "}
                                {(member.permissions?.specialCollectionScope || member.specialCollectionScope) === "specific"
                                  ? `(${(member.permissions?.allowedSpecialCollections || member.allowedSpecialCollections || []).length})`
                                  : "(All)"}
                              </span>
                            )}
                            {(member.permissions?.canViewGarbageReports || member.canViewGarbageReports) && (
                              <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[9px] font-bold border border-teal-300">
                                📊 Reports
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Flat */}
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {member.flat || "—"}{" "}
                        {member.block && (
                          <span className="text-xs text-gray-500 font-normal">
                            ({member.block})
                          </span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono text-xs text-gray-800">
                        {member.phone ? (
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(member.phone)}
                            className="flex items-center gap-1 hover:text-indigo-600"
                            title="Copy Phone"
                          >
                            <span>{member.phone}</span>
                            {copiedPhone === member.phone ? (
                              <FaCheck className="text-indigo-600 text-[10px]" />
                            ) : (
                              <FaCopy className="text-gray-400 text-[10px]" />
                            )}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Tenure */}
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {member.tenure || "—"}
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
                              setEditingMember(member);
                              setDrawerOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleOpenResetPassword(member)}
                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="Reset Password"
                          >
                            <FaKey />
                          </button>
                          <button
                            onClick={() => handleOpenBlock(member)}
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
                            type="button"
                            onClick={() => handleToggleGarbagePower(member)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              member.permissions?.canCollectGarbage || member.canCollectGarbage
                                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                            }`}
                            title={
                              member.permissions?.canCollectGarbage || member.canCollectGarbage
                                ? "GC Collection Power: ACTIVE (Click to Revoke)"
                                : "GC Collection Power: DISABLED (Click to Grant)"
                            }
                          >
                            <FaTrashAlt className="text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSpecialPower(member)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              member.permissions?.canCollectSpecial || member.canCollectSpecial
                                ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            }`}
                            title={
                              member.permissions?.canCollectSpecial || member.canCollectSpecial
                                ? "Special Collection Power: ACTIVE (Click to Revoke)"
                                : "Special Collection Power: DISABLED (Click to Grant)"
                            }
                          >
                            <FaHandHoldingHeart className="text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleReportPower(member)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              member.permissions?.canViewGarbageReports || member.canViewGarbageReports
                                ? "text-teal-700 bg-teal-50 hover:bg-teal-100"
                                : "text-slate-400 hover:text-teal-600 hover:bg-slate-100"
                            }`}
                            title={
                              member.permissions?.canViewGarbageReports || member.canViewGarbageReports
                                ? "Society Reports: ACTIVE (Click to Revoke)"
                                : "Society Reports: DISABLED (Click to Grant)"
                            }
                          >
                            <FaChartBar className="text-xs" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(member)}
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

      {/* 5. Add / Edit Committee Drawer */}
      <AddCommitteeDrawer
        open={drawerOpen}
        member={editingMember}
        onClose={() => {
          setDrawerOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
      />

      {/* 6. Direct Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                  <FaKey />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Reset Official Password</h3>
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
                    Share this temporary password with <strong>{resetTarget.name}</strong>.
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
                  You can set a custom password below, or leave it blank to automatically generate a secure temporary password.
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
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
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
                    className="px-5 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-xl transition flex items-center gap-2"
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
                      ? "Restore Official Access"
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
                  Are you sure you want to unblock <strong>{blockTarget.name}</strong>? They will regain access to the portal immediately.
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
                      placeholder="e.g. Governance review, term concluded"
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

      {/* 8. Quick Profile Photo Modal */}
      {photoTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
                  <FaCamera />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    Official Profile Photo
                  </h3>
                  <p className="text-xs text-indigo-700 font-medium">
                    {photoTarget.name} • {photoTarget.designation}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhotoTarget(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSavePhotoModal} className="p-5 space-y-4">
              {/* Photo Mode Switcher */}
              <div className="flex items-center justify-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPhotoModalMode("file")}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    photoModalMode === "file"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📁 Upload Device File
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoModalMode("url")}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    photoModalMode === "url"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🔗 Image URL / Path
                </button>
              </div>

              {/* Live Photo Preview */}
              <div className="flex flex-col items-center justify-center py-1">
                <div className="w-28 h-28 rounded-2xl bg-indigo-50 border-2 border-indigo-200 shadow-md flex items-center justify-center overflow-hidden relative">
                  {photoModalPreview ? (
                    <img
                      src={photoModalPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // fallback
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-indigo-300">
                      <FaUser className="text-4xl" />
                      <span className="text-[10px] font-semibold text-indigo-400 mt-1">No Image</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Preview in Residents Portal & Committee Directory
                </p>
              </div>

              {photoModalMode === "file" ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Choose Image File
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    id="quick-photo-file-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoModalFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setPhotoModalPreview(reader.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="quick-photo-file-input"
                      className="flex-1 cursor-pointer py-2.5 px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center justify-center gap-2 transition bg-white"
                    >
                      <FaCamera className="text-indigo-600" />
                      <span>{photoModalFile ? "Change Selected File" : "Browse File"}</span>
                    </label>

                    {photoModalPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalFile(null);
                          setPhotoModalPreview("");
                        }}
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    JPG, PNG, or WebP. Max 5MB. Uploads to Firebase Storage.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-700">
                    Image Link or Local Path
                  </label>
                  <div className="relative">
                    <FaLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. /committee/president.jpg or https://..."
                      value={photoModalUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhotoModalUrl(val);
                        setPhotoModalPreview(val.trim());
                      }}
                      className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>
                      Public path (e.g. <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">/committee/president.jpg</code>)
                    </span>
                    {photoModalPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalUrl("");
                          setPhotoModalPreview("");
                        }}
                        className="text-red-600 hover:text-red-700 font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPhotoTarget(null)}
                  disabled={photoModalLoading}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={photoModalLoading}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  {photoModalLoading ? "Saving..." : "Save Photo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Remove Committee Member"
          message={`Are you sure you want to remove "${confirmDelete.name}" (${confirmDelete.designation})? They will lose their official governance access.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
