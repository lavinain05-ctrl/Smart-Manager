import { useMemo, useState } from "react";
import {
  FaUserTie,
  FaSearch,
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
} from "react-icons/fa";

import { useGarbage } from "../../context/GarbageContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";

export default function GarbageCollectors() {
  const {
    garbageCollectors,
    garbageAccounts,
    garbageBills,
    collectors,
    selectedMonth,
    selectedYear,
    addGarbageCollectorAssignment,
    updateGarbageCollectorAssignment,
    deleteGarbageCollectorAssignment,
  } = useGarbage();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [form, setForm] = useState({
    collectorId: "",
    assignedBlocks: "",
    assignedRoute: "",
    status: "active",
  });

  // Filter
  const filtered = useMemo(() => {
    return garbageCollectors.filter((gc) =>
      `${gc.collectorName} ${gc.assignedBlocks?.join(" ") || ""} ${gc.assignedRoute || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [garbageCollectors, search]);

  // Collector performance stats
  function getStats(collectorId) {
    const assigned = garbageAccounts.filter((a) => a.collectorId === collectorId && a.status === "active").length;
    const bills = garbageBills.filter(
      (b) => b.collectedById === collectorId && b.month === selectedMonth && Number(b.year) === Number(selectedYear)
    );
    const collected = bills.reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
    return { assigned, billsCollected: bills.length, amountCollected: collected };
  }

  function openAdd() {
    setEditItem(null);
    setForm({ collectorId: "", assignedBlocks: "", assignedRoute: "", status: "active" });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      collectorId: item.collectorId || "",
      assignedBlocks: (item.assignedBlocks || []).join(", "),
      assignedRoute: item.assignedRoute || "",
      status: item.status || "active",
    });
    setShowForm(true);
  }

  function handleCollectorSelect(e) {
    const id = e.target.value;
    setForm({ ...form, collectorId: id });
  }

  async function handleSave() {
    const data = {
      collectorId: form.collectorId,
      assignedBlocks: form.assignedBlocks.split(",").map((b) => b.trim()).filter(Boolean),
      assignedRoute: form.assignedRoute,
      status: form.status,
    };

    if (editItem) {
      await updateGarbageCollectorAssignment(editItem.id, data);
    } else {
      await addGarbageCollectorAssignment(data);
    }
    setShowForm(false);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaUserTie className="text-emerald-600" />
            Garbage Collectors
          </h1>
          <p className="text-gray-500 mt-1">
            {garbageCollectors.length} assignments
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-emerald-500/30"
        >
          <FaPlus /> Assign Collector
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="relative">
          <FaSearch className="absolute left-4 top-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by collector name, block, route..."
            className="w-full border rounded-xl pl-12 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((gc) => {
          const stats = getStats(gc.collectorId);

          return (
            <div key={gc.id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{gc.collectorName || "Unassigned"}</h3>
                  <p className="text-gray-500 text-sm">
                    Route: {gc.assignedRoute || "N/A"}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  gc.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}>
                  {gc.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Blocks:</span>{" "}
                  {gc.assignedBlocks?.length > 0
                    ? gc.assignedBlocks.map((b) => (
                        <span key={b} className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs mr-1 mb-1">{b}</span>
                      ))
                    : "None"
                  }
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Assigned</p>
                  <p className="font-bold text-blue-700">{stats.assigned}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Collected</p>
                  <p className="font-bold text-emerald-700">{stats.billsCollected}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="font-bold text-purple-700">₹{stats.amountCollected.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(gc)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border hover:bg-blue-50 text-blue-600 text-sm transition"
                >
                  <FaEdit /> Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(gc)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border hover:bg-red-50 text-red-600 text-sm transition"
                >
                  <FaTrash /> Remove
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
            No collector assignments found
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editItem ? "Edit Assignment" : "Assign Collector"}
              </h2>
              <button onClick={() => setShowForm(false)} className="hover:text-red-300">
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collector</label>
                <select
                  value={form.collectorId}
                  onChange={handleCollectorSelect}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Select Collector --</option>
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Blocks (comma separated)
                </label>
                <input
                  value={form.assignedBlocks}
                  onChange={(e) => setForm({ ...form, assignedBlocks: e.target.value })}
                  placeholder="A, B, C"
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
                <input
                  value={form.assignedRoute}
                  onChange={(e) => setForm({ ...form, assignedRoute: e.target.value })}
                  placeholder="Route 1"
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
                >
                  {editItem ? "Update" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title="Remove Collector Assignment"
          message={`Remove ${confirmDelete.collectorName} from garbage collection?`}
          onConfirm={async () => {
            await deleteGarbageCollectorAssignment(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
