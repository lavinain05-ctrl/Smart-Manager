import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEye,
  FaTimes,
  FaSearch,
  FaLaptop,
  FaMobileAlt,
  FaExternalLinkAlt,
  FaUser,
  FaReceipt,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaCheckCircle,
  FaShieldAlt,
  FaHome,
  FaUserTie,
  FaTools,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { useCollectors } from "../../context/CollectorContext";
import { usePayments } from "../../context/PaymentContext";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { formatIdentifier } from "../../pages/admin/ActivityLogs";

export default function PortalScreenInspectorModal({
  isOpen,
  onClose,
  initialUser = null,
}) {
  const { impersonateUser } = useAuth();
  const { residents = [] } = useResidents();
  const { collectors = [] } = useCollectors();
  const { payments = [] } = usePayments();
  const navigate = useNavigate();

  const [deviceMode, setDeviceMode] = useState("desktop"); // "desktop" | "mobile"
  const [committeeMembers, setCommitteeMembers] = useState([]);
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "resident" | "collector" | "committee"
  const [selectedUser, setSelectedUser] = useState(null);
  const searchContainerRef = useRef(null);

  // Fetch committee members & bills once for live data simulation
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const commSnap = await getDocs(collection(db, "committee"));
        if (mounted) {
          setCommitteeMembers(
            commSnap.docs.map((d) => ({ id: d.id, ...d.data(), role: "committee" }))
          );
        }
        const billsSnap = await getDocs(collection(db, "bills"));
        if (mounted) {
          setBills(billsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.warn("[Inspector] Background data load failed:", err.message);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Consolidate all users across society database for the search/select selector
  const allSocietyMembers = useMemo(() => {
    const list = [];

    // 1. Residents
    (residents || []).forEach((r) => {
      list.push({
        ...r,
        uid: r.id || r.uid,
        id: r.id,
        residentId: r.id,
        name: r.owner || r.name || "Resident",
        owner: r.owner || r.name || "Resident",
        role: "resident",
        portal: "Resident Portal",
        phone: r.mobile || "",
        mobile: r.mobile || "",
        flat: r.flat || r.flatNumber || "",
        flatNumber: r.flat || r.flatNumber || "",
        block: r.block || "",
        status: "Active",
        raw: r,
      });
    });

    // 2. Collectors
    (collectors || []).forEach((c) => {
      list.push({
        ...c,
        uid: c.id || c.uid,
        id: c.id,
        name: c.name || "Collector",
        role: "collector",
        portal: "Collector Portal",
        phone: c.mobile || "",
        mobile: c.mobile || "",
        flat: "",
        area: c.area || "",
        status: "Active",
        raw: c,
      });
    });

    // 3. Committee
    (committeeMembers || []).forEach((cm) => {
      list.push({
        ...cm,
        uid: cm.id || cm.uid,
        id: cm.id,
        name: cm.name || "Committee Member",
        role: "committee",
        portal: "Committee Portal",
        phone: cm.phone || cm.mobile || "",
        mobile: cm.phone || cm.mobile || "",
        flat: cm.flat || "",
        designation: cm.designation || "Member",
        status: "Active",
        raw: cm,
      });
    });

    return list;
  }, [residents, collectors, committeeMembers]);


  // Set initial selected user whenever initialUser changes or modal opens
  useEffect(() => {
    if (initialUser) {
      const cleanId = formatIdentifier(initialUser.identifier || initialUser.mobile);
      // Try matching against society members
      const match = allSocietyMembers.find(
        (m) =>
          (initialUser.uid && m.uid === initialUser.uid) ||
          (cleanId && m.mobile && m.mobile.includes(cleanId)) ||
          (initialUser.name && m.name.toLowerCase() === initialUser.name.toLowerCase())
      );

      if (match) {
        setSelectedUser(match);
      } else if (initialUser.role === "admin" || (initialUser.portal && initialUser.portal.toLowerCase().includes("admin"))) {
        // If an admin row was opened, default to first society resident/collector so they don't see an unlinked profile
        if (allSocietyMembers.length > 0) {
          setSelectedUser(allSocietyMembers[0]);
        }
      } else {
        // Fallback to initialUser profile
        setSelectedUser({
          uid: initialUser.uid || "temp",
          id: initialUser.uid || "temp",
          name: initialUser.name || "User",
          role: initialUser.role || "resident",
          portal: initialUser.portal || "Resident Portal",
          mobile: cleanId || initialUser.identifier || "",
          flat: initialUser.flat || "",
          block: initialUser.block || "",
          status: "active",
        });
      }
    } else if (allSocietyMembers.length > 0 && !selectedUser) {
      setSelectedUser(allSocietyMembers[0]);
    }
  }, [initialUser, allSocietyMembers]);

  // Handle click outside search container to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Members filtered by role for the select dropdown
  const roleMembers = useMemo(() => {
    const list = allSocietyMembers.filter((m) => roleFilter === "all" || m.role === roleFilter);
    // Ensure selectedUser is present so select value is always valid
    if (selectedUser && !list.some((m) => m.uid === selectedUser.uid)) {
      return [selectedUser, ...list];
    }
    return list;
  }, [allSocietyMembers, roleFilter, selectedUser]);

  // Live search results with smart phone, flat, and name matching
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const digits = searchQuery.replace(/\D/g, "");

    return allSocietyMembers.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;

      const name = (m.name || "").toLowerCase();
      const mobile = (m.mobile || "").toLowerCase();
      const flat = (m.flat || "").toLowerCase();
      const block = (m.block || "").toLowerCase();
      const designation = (m.designation || "").toLowerCase();

      return (
        name.includes(q) ||
        flat.includes(q) ||
        `flat ${flat}`.includes(q) ||
        block.includes(q) ||
        designation.includes(q) ||
        mobile.includes(q) ||
        (digits.length >= 3 && mobile.replace(/\D/g, "").includes(digits))
      );
    });
  }, [allSocietyMembers, searchQuery, roleFilter]);

  // Handle typing in search input with live auto-detection
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setIsSearchOpen(true);

    const clean = val.trim().toLowerCase();
    const digits = val.replace(/\D/g, "");

    // Auto-select if exact 10-digit phone number match
    if (digits.length === 10) {
      const exactPhone = allSocietyMembers.find((m) => (m.mobile || "").replace(/\D/g, "").includes(digits));
      if (exactPhone) {
        setSelectedUser(exactPhone);
        return;
      }
    }

    // Auto-select if exact flat match (e.g., "D572" or "flat D572")
    if (clean.length >= 2) {
      const exactFlat = allSocietyMembers.find(
        (m) => (m.flat || "").toLowerCase() === clean || `flat ${(m.flat || "").toLowerCase()}` === clean
      );
      if (exactFlat) {
        setSelectedUser(exactFlat);
      }
    }
  };

  const handleSelectMember = (member) => {
    setSelectedUser(member);
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  // Calculate live user-specific data
  const userData = useMemo(() => {
    if (!selectedUser) return null;

    const userFlat = selectedUser.flat || "";
    const userRole = selectedUser.role || "resident";
    const userUid = selectedUser.uid || selectedUser.id;

    if (userRole === "resident") {
      const userBills = bills.filter(
        (b) => userFlat && (b.flat === userFlat || b.flatNumber === userFlat)
      );
      const userPayments = payments.filter(
        (p) => userFlat && (p.flat === userFlat || p.userId === userUid)
      );
      const unpaidBills = userBills.filter((b) => (b.status || "").toLowerCase() !== "paid");
      const totalDue = unpaidBills.reduce((acc, b) => acc + Number(b.amount || b.totalAmount || 0), 0);

      return {
        type: "resident",
        bills: userBills,
        unpaidBills,
        totalDue,
        payments: userPayments,
        totalPaid: userPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0),
      };
    }

    if (userRole === "collector") {
      const userCollections = payments.filter(
        (p) =>
          p.collectorId === userUid ||
          (p.collector && p.collector.toLowerCase() === selectedUser.name.toLowerCase())
      );
      const totalCollected = userCollections.reduce((acc, p) => acc + Number(p.amount || 0), 0);

      return {
        type: "collector",
        collections: userCollections,
        totalCollected,
        collectionsCount: userCollections.length,
      };
    }

    if (userRole === "committee") {
      return {
        type: "committee",
        designation: selectedUser.designation || "Member",
      };
    }

    return null;
  }, [selectedUser, bills, payments]);

  // Launch live portal experience in full page view
  const handleLaunchLive = (preferredMode) => {
    if (!selectedUser) return;

    if (selectedUser.role === "admin" || (selectedUser.portal && selectedUser.portal.toLowerCase().includes("admin"))) {
      alert("This is an Administrator account. Admin does not have a resident flat. Please choose a Resident (e.g., ANSH NAIN, Flat D572) or Collector to launch their portal.");
      return;
    }

    const mode = preferredMode || deviceMode;
    impersonateUser(selectedUser, mode);
    onClose();

    const role = (selectedUser.role || "resident").toLowerCase();
    if (role === "collector") {
      navigate("/collector/dashboard");
    } else if (role === "committee") {
      navigate("/committee/dashboard");
    } else {
      navigate("/resident/dashboard");
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Top Header Bar */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg font-bold border border-amber-500/30">
              <FaEye />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-lg text-white">Live Portal Screen Inspector</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin Real-Time Mirror
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect the exact portal screen seen by any resident, collector, or committee member to troubleshoot issues.
              </p>
            </div>
          </div>

          {/* Right Action Controls: Device Mode Switch & Close */}
          <div className="flex items-center gap-2.5 self-end md:self-auto">
            {/* Device Switcher */}
            <div className="flex items-center bg-slate-700/70 p-1 rounded-xl border border-slate-600">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  deviceMode === "desktop"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Simulate Desktop View"
              >
                <FaLaptop /> Desktop Screen
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  deviceMode === "mobile"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Simulate Mobile Device View"
              >
                <FaMobileAlt /> Mobile Screen
              </button>
            </div>

            {/* Launch Full Portal Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleLaunchLive("mobile")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow transition ${
                  deviceMode === "mobile"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/30"
                    : "bg-slate-700/80 hover:bg-slate-700 text-slate-200"
                }`}
                title="Open full portal inside a simulated mobile device screen"
              >
                <FaMobileAlt /> Launch Mobile Screen
              </button>

              <button
                onClick={() => handleLaunchLive("desktop")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow transition ${
                  deviceMode === "desktop"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-orange-500/30"
                    : "bg-slate-700/80 hover:bg-slate-700 text-slate-200"
                }`}
                title="Open full desktop portal experience"
              >
                <FaExternalLinkAlt /> Launch Desktop View
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Member Selector Bar */}
        <div className="px-6 py-3 bg-slate-800 border-b border-slate-700/70 flex flex-col md:flex-row items-center gap-3">
          {/* Member Search Bar with Live Suggestions Dropdown */}
          <div className="relative flex-1 w-full" ref={searchContainerRef}>
            <div className="relative flex items-center">
              <FaSearch className="absolute left-3.5 text-slate-400 text-xs pointer-events-none" />
              <input
                type="text"
                placeholder="Search member by Name, Phone, or Flat (e.g. 9643445720, Flat D572)..."
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchResults.length > 0) {
                    handleSelectMember(searchResults[0]);
                  } else if (e.key === "Escape") {
                    setIsSearchOpen(false);
                  }
                }}
                className="w-full pl-9 pr-9 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-md transition"
                  title="Clear search"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            {/* Interactive Search Suggestions Dropdown */}
            {isSearchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-800/80 animate-fadeIn">
                <div className="px-3 py-1.5 bg-slate-800/80 text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
                  <span>
                    {searchQuery ? `Matching Members (${searchResults.length})` : `All Society Members (${searchResults.length})`}
                  </span>
                  <span className="text-slate-500 font-normal lowercase">click to inspect</span>
                </div>

                {searchResults.length > 0 ? (
                  searchResults.slice(0, 15).map((m) => {
                    const isSelected = selectedUser?.uid === m.uid;
                    const roleColor =
                      m.role === "resident"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : m.role === "collector"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-purple-500/15 text-purple-300 border-purple-500/30";

                    return (
                      <button
                        key={m.uid}
                        type="button"
                        onClick={() => handleSelectMember(m)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-800 transition ${
                          isSelected ? "bg-slate-800/90 border-l-4 border-emerald-500" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-xs text-white truncate">{m.name}</p>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${roleColor}`}>
                                {m.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {m.flat && <span>Flat {m.flat}</span>}
                              {m.block && <span>• {m.block}</span>}
                              {m.mobile && <span className="font-mono">• {m.mobile}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          <span
                            className={`text-[10px] px-2 py-1 rounded font-medium ${
                              isSelected
                                ? "bg-emerald-600 text-white font-bold"
                                : "bg-slate-800 text-slate-300 group-hover:bg-slate-700"
                            }`}
                          >
                            {isSelected ? "Inspecting" : "Inspect →"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    <p>No society members found matching "{searchQuery}"</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Try searching by phone number (e.g. 9289650989) or flat number (e.g. D572).
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Portals</option>
              <option value="resident">🏠 Resident Portal</option>
              <option value="collector">👤 Collector Portal</option>
              <option value="committee">👥 Committee Portal</option>
            </select>

            <select
              value={selectedUser?.uid || ""}
              onChange={(e) => {
                const target = allSocietyMembers.find((m) => m.uid === e.target.value);
                if (target) {
                  setSelectedUser(target);
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[240px]"
            >
              {roleMembers.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.name} ({m.role.toUpperCase()}{m.flat ? ` • Flat ${m.flat}` : ""})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal Main Area: Split into Simulator Canvas + Diagnostics Sidebar */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-950">
          {/* Left Canvas: Screen Simulator */}
          <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center bg-slate-900/50">
            {selectedUser ? (
              <div
                className={`transition-all duration-300 bg-slate-50 text-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-slate-300 flex flex-col ${
                  deviceMode === "mobile"
                    ? "w-[390px] h-[680px] rounded-[36px] border-4 border-slate-700 shadow-2xl"
                    : "w-full max-w-4xl min-h-[520px]"
                }`}
              >
                {/* Simulated Device Top Notch / Browser Bar */}
                {deviceMode === "mobile" ? (
                  <div className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between text-[11px] font-semibold border-b border-slate-800 relative select-none shrink-0">
                    <span className="font-mono">9:41</span>
                    {/* Dynamic Island pill */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-5 bg-black rounded-full border border-slate-800 flex items-center justify-between px-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[9px] font-bold text-slate-300">5G</span>
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800 text-slate-200 px-4 py-2 flex items-center justify-between text-[11px] border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <span className="font-mono text-[10px] text-slate-400 ml-2">
                        https://rwa-portal.local/{selectedUser.role}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold">
                      {selectedUser.portal}
                    </span>
                  </div>
                )}

                {/* Simulated Portal Content */}
                <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-gray-50 text-slate-800">
                  {/* Simulated Header */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-800">
                        Hello, {selectedUser.name}!
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedUser.role === "resident"
                          ? `Flat: ${selectedUser.flat || "—"} • Block: ${selectedUser.block || "—"}`
                          : selectedUser.role === "collector"
                          ? `Collector Area: ${selectedUser.area || "General Society"}`
                          : `Designation: ${selectedUser.designation || "Committee Member"}`}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* RESIDENT PORTAL SCREEN SIMULATION */}
                  {selectedUser.role === "resident" && userData && (
                    <div className="space-y-4">
                      {/* Dues & Balance Card */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Total Unpaid Dues
                          </p>
                          <h4 className={`text-xl font-bold mt-1 ${userData.totalDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            ₹{userData.totalDue.toLocaleString()}
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {userData.unpaidBills.length} Pending Bills
                          </p>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Total Lifetime Paid
                          </p>
                          <h4 className="text-xl font-bold text-emerald-600 mt-1">
                            ₹{userData.totalPaid.toLocaleString()}
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {userData.payments.length} Payments Recorded
                          </p>
                        </div>
                      </div>

                      {/* Unpaid Bills Section */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2.5">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <FaMoneyBillWave className="text-amber-500" /> Active Bills for this Flat
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                            {userData.unpaidBills.length} Due
                          </span>
                        </div>

                        {userData.unpaidBills.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {userData.unpaidBills.slice(0, 3).map((b, idx) => (
                              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-semibold text-slate-800">{b.month || "Maintenance"} {b.year || ""}</p>
                                  <p className="text-[10px] text-gray-400">Due Date: {b.dueDate || "Immediate"}</p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-slate-800 text-sm">₹{b.amount || b.totalAmount || 0}</span>
                                  <span className="block text-[10px] font-semibold text-red-500">Unpaid</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-600 font-medium py-2 flex items-center gap-1">
                            <FaCheckCircle /> All bills are paid up to date!
                          </p>
                        )}
                      </div>

                      {/* Recent Receipts Preview */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                          <FaReceipt className="text-blue-500" /> Receipts & Payment History
                        </h4>
                        {userData.payments.length > 0 ? (
                          <div className="divide-y divide-gray-100 text-xs">
                            {userData.payments.slice(0, 3).map((p, idx) => (
                              <div key={idx} className="py-2 flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-800">₹{p.amount} • {p.paymentMethod || "Cash"}</p>
                                  <p className="text-[10px] text-gray-400">Receipt: {p.receiptNumber || "—"}</p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
                                  Success
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 py-2">No payment receipts found.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* COLLECTOR PORTAL SCREEN SIMULATION */}
                  {selectedUser.role === "collector" && userData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Total Collected
                          </p>
                          <h4 className="text-xl font-bold text-emerald-600 mt-1">
                            ₹{userData.totalCollected.toLocaleString()}
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">Lifetime Collections</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            Receipts Issued
                          </p>
                          <h4 className="text-xl font-bold text-blue-600 mt-1">
                            {userData.collectionsCount}
                          </h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">Houses Collected</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2.5">
                          Collector Screen Actions
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl font-semibold border border-emerald-100 flex items-center gap-2">
                            <FaMoneyBillWave /> Collect Garbage Bill
                          </div>
                          <div className="p-3 bg-blue-50 text-blue-800 rounded-xl font-semibold border border-blue-100 flex items-center gap-2">
                            <FaReceipt /> Issue Instant Receipt
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COMMITTEE PORTAL SCREEN SIMULATION */}
                  {selectedUser.role === "committee" && (
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-xs">
                        <p className="font-bold text-slate-800 text-sm">Committee Management Screen</p>
                        <p className="text-gray-500 mt-1">
                          Designation: <span className="font-semibold text-slate-700">{selectedUser.designation}</span>
                        </p>
                        <p className="text-gray-500 mt-0.5">
                          Assigned Flat: <span className="font-semibold text-slate-700">{selectedUser.flat || "General Member"}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ADMIN ROLE SCREEN SIMULATION */}
                  {(selectedUser.role === "admin" || (selectedUser.portal && selectedUser.portal.toLowerCase().includes("admin"))) && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl mx-auto mb-3">
                        <FaShieldAlt />
                      </div>
                      <h4 className="font-bold text-slate-800 text-base">Administrator Account ({selectedUser.name})</h4>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
                        This is an Administrator account with full society management privileges. Administrators do not have a resident flat or collector route assigned.
                      </p>
                      <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-left">
                        <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                          <FaCheckCircle className="text-emerald-500 shrink-0" />
                          To inspect a live portal screen:
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-1">
                          Use the search bar above to select any <strong>Resident</strong> (e.g. ANSH NAIN, Flat D572) or <strong>Collector</strong> to mirror their exact screen.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-slate-400">
                <FaUser className="text-4xl mx-auto mb-2 opacity-30" />
                <p>No user selected.</p>
              </div>
            )}
          </div>

          {/* Right Sidebar: Health Diagnostics & Quick Resolution */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-5 space-y-4 overflow-y-auto">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FaTools className="text-amber-400" /> Account Diagnostics
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatic audit checks to help resolve technical errors reported by this user.
              </p>
            </div>

            {selectedUser && (
              <div className="space-y-2 text-xs">
                {/* Check 1: Phone Registered */}
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-start gap-2.5">
                  <FaCheckCircle className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Mobile Registration</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {selectedUser.mobile || "⚠️ Missing mobile number"}
                    </p>
                  </div>
                </div>

                {/* Check 2: Account Status */}
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-start gap-2.5">
                  <FaCheckCircle className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Account Status</p>
                    <p className="text-[11px] text-emerald-400 capitalize mt-0.5 font-medium">
                      {selectedUser.status} • Active in Society
                    </p>
                  </div>
                </div>

                {/* Check 3: Flat Allocation */}
                {selectedUser.role === "resident" && (
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-start gap-2.5">
                    {selectedUser.flat ? (
                      <FaCheckCircle className="text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <FaExclamationTriangle className="text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-white">Flat & Block Allocation</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedUser.flat
                          ? `Flat ${selectedUser.flat} (${selectedUser.block || "No Block"})`
                          : "⚠️ No flat assigned (Bills cannot attach)"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Launch Full View As Button */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                onClick={() => handleLaunchLive("mobile")}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
                title="Open this user's portal inside a simulated mobile device screen"
              >
                <FaMobileAlt /> Open as Mobile Device Screen
              </button>
              <button
                onClick={() => handleLaunchLive("desktop")}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
                title="Open this user's portal in desktop screen view"
              >
                <FaLaptop /> Open as Desktop Screen
              </button>
              <p className="text-[10px] text-slate-500 text-center">
                Allows Admin to navigate their exact portal pages and test buttons live.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
