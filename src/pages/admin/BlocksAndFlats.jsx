import { useState, useMemo } from "react";
import {
  FaBuilding,
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaDoorOpen,
  FaUser,
  FaChevronDown,
  FaChevronRight,
  FaRecycle,
  FaMoneyBillWave,
  FaClock,
  FaCheckCircle,
  FaMagic,
} from "react-icons/fa";

import { useBlockFlat } from "../../context/BlockFlatContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useGarbage } from "../../context/GarbageContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { isGcParticipating } from "../../services/statisticsService";

const FLAT_STATUSES = [
  { value: "occupied", label: "Occupied", color: "bg-green-100 text-green-700" },
  { value: "vacant", label: "Vacant", color: "bg-yellow-100 text-yellow-700" },
  { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-600" },
];

const BLOCK_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "under_construction", label: "Under Construction" },
];

export default function BlocksAndFlats() {
  const {
    blocks, flats, residents,
    addBlock, updateBlock, deleteBlock,
    addFlat, updateFlat, deleteFlat,
    linkResidentToFlat, unlinkResidentFromFlat,
    generateFlats,
  } = useBlockFlat();

  const { payments } = usePayments();
  const { selectedMonth, selectedYear } = useBilling();
  const { garbageBills } = useGarbage();

  // UI state
  const [search, setSearch] = useState("");
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [showFlatForm, setShowFlatForm] = useState(false);
  const [editingFlat, setEditingFlat] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateBlockId, setGenerateBlockId] = useState(null);

  // Block form
  const [blockName, setBlockName] = useState("");
  const [blockStatus, setBlockStatus] = useState("active");

  // Flat form
  const [flatNumber, setFlatNumber] = useState("");
  const [flatFloor, setFlatFloor] = useState("");
  const [flatStatus, setFlatStatus] = useState("vacant");
  const [flatResidentId, setFlatResidentId] = useState("");

  // Generate form
  const [genCount, setGenCount] = useState("");
  const [genStart, setGenStart] = useState("");

  // =============================================
  // Per-block computed stats
  // =============================================

  const monthlyPayments = useMemo(() => {
    return payments.filter(
      (p) => p.month === selectedMonth && Number(p.year) === Number(selectedYear)
    );
  }, [payments, selectedMonth, selectedYear]);

  const paidResidentIds = useMemo(() => {
    const set = new Set(monthlyPayments.map((p) => p.residentId));
    (garbageBills || [])
      .filter((b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear) && (b.status === "Paid" || b.status === "Exempted"))
      .forEach((b) => { if (b.residentId) set.add(b.residentId); });
    return set;
  }, [monthlyPayments, garbageBills, selectedMonth, selectedYear]);

  function getBlockStats(blockId) {
    const blockFlats = flats.filter((f) => f.blockId === blockId);
    const block = blocks.find((b) => b.id === blockId);

    // Normalize flat number for comparison
    const normalizeFlat = (f) => (f || "").trim().toUpperCase().replace(/[\s\-_]+/g, "");

    // Build a set of occupied flat keys using BOTH flat.residentId AND resident data
    const occupiedFlatKeys = new Set();

    // 1. Flats that already have a residentId set
    blockFlats.forEach((f) => {
      if (f.residentId) {
        occupiedFlatKeys.add(normalizeFlat(f.flatNumber));
      }
    });

    // 2. Residents whose blockId or block name matches this block
    const flatResidentIds = new Set(
      blockFlats.filter((f) => f.residentId).map((f) => f.residentId)
    );
    const blockResidents = (residents || []).filter(
      (r) => flatResidentIds.has(r.id) ||
        (block && r.block === block.name) ||
        (r.blockId === blockId)
    );

    // Mark flats as occupied if a resident's flatNumber matches
    const blockFlatKeys = new Set(blockFlats.map((f) => normalizeFlat(f.flatNumber)));
    blockResidents.forEach((r) => {
      const rFlatKey = normalizeFlat(r.flat || r.flatNumber);
      if (blockFlatKeys.has(rFlatKey)) {
        occupiedFlatKeys.add(rFlatKey);
      }
    });

    const occupied = occupiedFlatKeys.size;
    const vacant = Math.max(0, blockFlats.length - occupied);

    const gcParticipants = blockResidents.filter(
      (r) => isGcParticipating(r)
    ).length;
    const gcNonParticipants = blockResidents.length - gcParticipants;

    // Payment stats for this block's residents
    const blockResidentIds = new Set(blockResidents.map((r) => r.id));
    const blockPayments = monthlyPayments.filter((p) => blockResidentIds.has(p.residentId));
    const collected = blockPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const expected = blockResidents.reduce((s, r) => s + Number(r.charge || 0), 0);
    const pending = Math.max(0, expected - collected);
    const paidCount = blockResidents.filter((r) => paidResidentIds.has(r.id)).length;

    return {
      totalFlats: blockFlats.length,
      occupied,
      vacant,
      residents: blockResidents.length,
      gcParticipants,
      gcNonParticipants,
      collected,
      expected,
      pending,
      paidCount,
    };
  }

  // =============================================
  // Form handlers
  // =============================================

  function resetBlockForm() {
    setBlockName("");
    setBlockStatus("active");
    setEditingBlock(null);
    setShowBlockForm(false);
  }

  function resetFlatForm() {
    setFlatNumber("");
    setFlatFloor("");
    setFlatStatus("vacant");
    setFlatResidentId("");
    setEditingFlat(null);
    setShowFlatForm(false);
    setActiveBlockId(null);
  }

  function openEditBlock(block) {
    setBlockName(block.name);
    setBlockStatus(block.status || "active");
    setEditingBlock(block);
    setShowBlockForm(true);
  }

  function openAddFlat(blockId) {
    resetFlatForm();
    setActiveBlockId(blockId);
    setShowFlatForm(true);
  }

  function openEditFlat(flat) {
    setFlatNumber(flat.flatNumber || "");
    setFlatFloor(flat.floor?.toString() || "");
    setFlatStatus(flat.status || "vacant");
    setFlatResidentId(flat.residentId || "");
    setActiveBlockId(flat.blockId);
    setEditingFlat(flat);
    setShowFlatForm(true);
  }

  function openGenerateForm(blockId) {
    setGenerateBlockId(blockId);
    setGenCount("");
    setGenStart("");
    setShowGenerateForm(true);
  }

  async function handleBlockSubmit(e) {
    e.preventDefault();
    if (!blockName.trim()) return;
    setLoading(true);

    const data = {
      name: blockName.trim(),
      status: blockStatus,
    };

    if (editingBlock) {
      await updateBlock(editingBlock.id, data);
    } else {
      await addBlock(data);
    }

    resetBlockForm();
    setLoading(false);
  }

  async function handleFlatSubmit(e) {
    e.preventDefault();
    if (!flatNumber.trim() || !activeBlockId) return;
    setLoading(true);

    const block = blocks.find((b) => b.id === activeBlockId);

    const data = {
      flatNumber: flatNumber.trim(),
      blockId: activeBlockId,
      blockName: block?.name || "",
      floor: flatFloor,
      status: flatResidentId ? "occupied" : flatStatus,
      residentId: flatResidentId || "",
    };

    if (editingFlat) {
      await updateFlat(editingFlat.id, data);
    } else {
      await addFlat(data);
    }

    resetFlatForm();
    setLoading(false);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!genCount || !generateBlockId) return;
    setLoading(true);

    const block = blocks.find((b) => b.id === generateBlockId);
    await generateFlats(
      generateBlockId,
      block?.name || "",
      Number(genCount),
      genStart,
      Number(block?.floors || 0)
    );

    setShowGenerateForm(false);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    if (confirmDelete.type === "block") {
      await deleteBlock(confirmDelete.id);
    } else {
      await deleteFlat(confirmDelete.id);
    }
    setConfirmDelete(null);
  }

  // Filter blocks by search
  const filteredBlocks = blocks.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const blockFlats = flats.filter((f) => f.blockId === b.id);
    return (
      b.name.toLowerCase().includes(s) ||
      blockFlats.some(
        (f) =>
          f.flatNumber?.toLowerCase().includes(s) ||
          f.residentName?.toLowerCase().includes(s)
      )
    );
  });



  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Blocks & Flats</h1>
          <p className="text-gray-500">Manage society blocks, flats, and resident allocation</p>
        </div>
        <button
          onClick={() => { resetBlockForm(); setShowBlockForm(true); }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus /> Add Block
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-indigo-500">
          <p className="text-xs text-gray-500 font-medium">Total Blocks</p>
          <p className="text-2xl font-bold">{blocks.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-emerald-500">
          <p className="text-xs text-gray-500 font-medium">Total Residents</p>
          <p className="text-2xl font-bold">{(residents || []).length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-teal-500">
          <p className="text-xs text-gray-500 font-medium">GC Participating</p>
          <p className="text-2xl font-bold">
            {(residents || []).filter((r) => isGcParticipating(r)).length}
          </p>
        </div>
      </div>

      {/* Search */}
      {blocks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search blocks, flats, residents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* Blocks List */}
      {filteredBlocks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaBuilding className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">{blocks.length === 0 ? "No Blocks Yet" : "No Results"}</h2>
          <p className="mt-2">{blocks.length === 0 ? "Add your first block to start managing flats." : "No blocks match your search."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBlocks.map((block) => {
            const blockFlats = flats
              .filter((f) => f.blockId === block.id)
              .sort((a, b) => (a.flatNumber || "").localeCompare(b.flatNumber || "", undefined, { numeric: true }));

            const isExpanded = expandedBlock === block.id;
            const stats = getBlockStats(block.id);

            return (
              <div key={block.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">

                {/* Block Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <FaBuilding className="text-indigo-600 text-xl" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{block.name}</h3>
                        {block.status && block.status !== "active" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-700">
                            {block.status === "under_construction" ? "Under Construction" : "Inactive"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {stats.residents} {stats.residents === 1 ? "resident" : "residents"}
                      </p>
                    </div>
                  </div>

                  {/* Mini stats badges */}
                  <div className="hidden xl:flex items-center gap-3 mr-4">
                    {stats.gcParticipants > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
                        <FaRecycle className="text-[10px]" /> {stats.gcParticipants} GC
                      </span>
                    )}
                    {stats.collected > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                        <FaCheckCircle className="text-[10px]" /> ₹{stats.collected.toLocaleString()}
                      </span>
                    )}
                    {stats.pending > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg">
                        <FaClock className="text-[10px]" /> ₹{stats.pending.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openGenerateForm(block.id); }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
                      title="Auto-generate Flats"
                    >
                      <FaMagic className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddFlat(block.id); }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                      title="Add Flat"
                    >
                      <FaPlus className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditBlock(block); }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                      <FaEdit className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "block", id: block.id, name: block.name }); }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                    {isExpanded ? <FaChevronDown className="text-gray-400" /> : <FaChevronRight className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded: Block Stats + Flats Grid */}
                {isExpanded && (
                  <div className="border-t">

                    {/* Block detail stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-5 py-4 bg-slate-50 border-b">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Residents</p>
                        <p className="text-lg font-bold text-indigo-600">{stats.residents}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">GC Active</p>
                        <p className="text-lg font-bold text-emerald-600">{stats.gcParticipants}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">GC Inactive</p>
                        <p className="text-lg font-bold text-gray-500">{stats.gcNonParticipants}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Collected</p>
                        <p className="text-lg font-bold text-green-600">₹{stats.collected.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Pending</p>
                        <p className="text-lg font-bold text-red-600">₹{stats.pending.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Description / Notes */}
                    {(block.description || block.adminNotes) && (
                      <div className="px-5 py-3 bg-white border-b text-sm text-gray-600">
                        {block.description && <p>{block.description}</p>}
                        {block.adminNotes && <p className="text-xs text-gray-400 mt-1">Note: {block.adminNotes}</p>}
                      </div>
                    )}

                    {/* Flats Grid */}
                    <div className="px-5 py-4 bg-gray-50">
                      {blockFlats.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-400 mb-3">No flats in this block yet.</p>
                          <button
                            onClick={() => openGenerateForm(block.id)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition"
                          >
                            <FaMagic className="inline mr-2" /> Auto-Generate Flats
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          {blockFlats.map((flat) => {
                            const statusConfig = FLAT_STATUSES.find((s) => s.value === flat.status) || FLAT_STATUSES[1];
                            const isPaid = flat.residentId && paidResidentIds.has(flat.residentId);

                            return (
                              <div
                                key={flat.id}
                                className={`bg-white rounded-xl border p-3 hover:shadow-md transition cursor-pointer ${
                                  isPaid ? "ring-1 ring-green-300" : ""
                                }`}
                                onClick={() => openEditFlat(flat)}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold text-sm">{flat.flatNumber}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig.color}`}>
                                    {statusConfig.label}
                                  </span>
                                </div>
                                {flat.residentName ? (
                                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                    <FaUser className="text-[10px] shrink-0" /> {flat.residentName}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-300 flex items-center gap-1">
                                    <FaDoorOpen className="text-[10px]" /> Empty
                                  </p>
                                )}
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-[10px] text-gray-400">Floor {flat.floor || "—"}</p>
                                  {flat.residentId && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                    }`}>
                                      {isPaid ? "Paid" : "Unpaid"}
                                    </span>
                                  )}
                                </div>
                                {isGcParticipating({ garbageStatus: flat.garbageStatus }) && (
                                  <span className="text-[9px] text-emerald-600 flex items-center gap-0.5 mt-1">
                                    <FaRecycle className="text-[8px]" /> GC Active
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================= Block Form Modal ============================= */}
      {showBlockForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">{editingBlock ? "Edit Block" : "Add Block"}</h2>
              <button onClick={resetBlockForm} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleBlockSubmit} className="p-6 space-y-4">
              <div>
                <label className="block mb-2 font-medium">Block Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. 90 Metre, 120 Metre, 200 Metre"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={resetBlockForm} className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold transition">
                  {loading ? "Saving..." : editingBlock ? "Update" : "Add Block"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================= Flat Form Modal ============================= */}
      {showFlatForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">
                {editingFlat ? "Edit Flat" : "Add Flat"} — {blocks.find((b) => b.id === activeBlockId)?.name}
              </h2>
              <button onClick={resetFlatForm} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleFlatSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Flat Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 101"
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Floor</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={flatFloor}
                    onChange={(e) => setFlatFloor(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium">Status</label>
                <select
                  value={flatStatus}
                  onChange={(e) => setFlatStatus(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {FLAT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium">Assign Resident</label>
                <select
                  value={flatResidentId}
                  onChange={(e) => setFlatResidentId(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">— No Resident —</option>
                  {(residents || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.owner} ({r.flat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={resetFlatForm} className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition">
                  Cancel
                </button>
                {editingFlat && (
                  <button
                    type="button"
                    onClick={() => { setConfirmDelete({ type: "flat", id: editingFlat.id, name: editingFlat.flatNumber }); resetFlatForm(); }}
                    className="px-6 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
                  >
                    Delete
                  </button>
                )}
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold transition">
                  {loading ? "Saving..." : editingFlat ? "Update" : "Add Flat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================= Generate Flats Modal ============================= */}
      {showGenerateForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaMagic className="text-purple-600" /> Generate Flats
              </h2>
              <button onClick={() => setShowGenerateForm(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Auto-create flats for <strong>{blocks.find((b) => b.id === generateBlockId)?.name}</strong>.
                Flat numbers will be generated as floor-prefixed numbers (e.g., 101, 102, 201, 202...).
              </p>
              <div>
                <label className="block mb-2 font-medium">Number of Flats <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  placeholder="e.g. 24"
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-purple-500 outline-none"
                  min="1"
                  max="500"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Start Number (optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 101 (auto if empty)"
                  value={genStart}
                  onChange={(e) => setGenStart(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-purple-500 outline-none"
                  min="1"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowGenerateForm(false)} className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold transition">
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title={`Delete ${confirmDelete.type === "block" ? "Block" : "Flat"}`}
          message={
            confirmDelete.type === "block"
              ? `Are you sure you want to delete block "${confirmDelete.name}"? Any vacant flats in this block will also be removed.`
              : `Are you sure you want to delete flat "${confirmDelete.name}"?`
          }
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
