import { useMemo, useState, useEffect } from "react";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
  FaTimes,
  FaUsers,
  FaUserTie,
  FaSync,
} from "react-icons/fa";

import { useGarbage } from "../../context/GarbageContext";
import { isGcParticipating } from "../../services/statisticsService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Pagination from "../../components/common/Pagination";
import toast from "react-hot-toast";

export default function GarbageAccounts() {
  const {
    garbageAccounts,
    garbageSettings,
    residents,
    collectors,
    addAccount,
    updateAccount,
    deleteAccount,
    toggleAccountStatus,
    assignCollectorToAccount,
    reconcileGarbageAccounts,
    relinkAccount,
  } = useGarbage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAssign, setShowAssign] = useState(null);
  const [showRelink, setShowRelink] = useState(null);
  const [relinkResidentId, setRelinkResidentId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form state — only IDs + garbage-specific fields
  const [form, setForm] = useState({
    residentId: "",
    monthlyCharge: "",
    status: "active",
  });

  // Unique blocks (from resolved data)
  const blocks = useMemo(() => {
    const set = new Set(garbageAccounts.map((a) => a.block).filter(Boolean));
    return [...set].sort();
  }, [garbageAccounts]);

  // Already-enrolled resident IDs
  const enrolledIds = useMemo(
    () => new Set(garbageAccounts.map((a) => a.residentId).filter(Boolean)),
    [garbageAccounts]
  );

  // Available residents (not yet enrolled)
  const availableResidents = useMemo(
    () => (residents || []).filter((r) => !enrolledIds.has(r.id)),
    [residents, enrolledIds]
  );

  // Unlinked accounts count
  const unlinkedCount = useMemo(
    () => garbageAccounts.filter((a) => a._isUnlinked).length,
    [garbageAccounts]
  );

  // Count participating residents that don't have accounts yet
  const missingAccountCount = useMemo(() => {
    const participating = (residents || []).filter(
      (r) =>
        isGcParticipating(r) &&
        r.status !== "Inactive" && r.status !== "inactive"
    );
    return participating.filter((r) => !enrolledIds.has(r.id)).length;
  }, [residents, enrolledIds]);

  // Filtered accounts (resolved data has residentName/flat/block from master)
  const filtered = useMemo(() => {
    return garbageAccounts.filter((acc) => {
      const matchSearch =
        `${acc.residentName} ${acc.flat} ${acc.block}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || acc.status === statusFilter;
      const matchBlock = blockFilter === "all" || acc.block === blockFilter;
      return matchSearch && matchStatus && matchBlock;
    });
  }, [garbageAccounts, search, statusFilter, blockFilter]);

  useEffect(() => {
    setPage(1);
  }, [filtered.length]);

  const pagedAccounts = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= filtered.length) {
      return filtered;
    }
    const numericSize = Number(pageSize) || 25;
    const start = (page - 1) * numericSize;
    return filtered.slice(start, start + numericSize);
  }, [filtered, page, pageSize]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await reconcileGarbageAccounts();
      toast.success(
        `Sync complete: ${res?.statusSynced || 0} statuses synced, ${res?.accountsCreated || 0} accounts enrolled`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync accounts");
    } finally {
      setSyncing(false);
    }
  }

  function openAdd() {
    setEditAccount(null);
    setForm({
      residentId: "",
      monthlyCharge: garbageSettings.defaultCharge || "",
      status: "active",
    });
    setShowForm(true);
  }

  function openEdit(acc) {
    setEditAccount(acc);
    setForm({
      residentId: acc.residentId || "",
      monthlyCharge: acc.monthlyCharge || "",
      status: acc.status || "active",
    });
    setShowForm(true);
  }

  // Get selected resident info for display in form
  const selectedResident = useMemo(() => {
    if (!form.residentId) return null;
    return (residents || []).find((r) => r.id === form.residentId) || null;
  }, [form.residentId, residents]);

  function handleResidentSelect(e) {
    const id = e.target.value;
    const resident = (residents || []).find((r) => r.id === id);
    if (resident) {
      setForm({
        ...form,
        residentId: id,
        monthlyCharge: form.monthlyCharge || resident.charge || garbageSettings.defaultCharge || "",
      });
    }
  }

  async function handleSave() {
    if (!form.residentId) {
      return;
    }

    if (editAccount) {
      await updateAccount(editAccount.id, {
        monthlyCharge: Number(form.monthlyCharge || 0),
        status: form.status,
      });
    } else {
      await addAccount({
        residentId: form.residentId,
        monthlyCharge: Number(form.monthlyCharge || 0),
        collectorId: "",
      });
    }

    setShowForm(false);
  }

  async function handleRelink() {
    if (!showRelink || !relinkResidentId) return;
    const ok = await relinkAccount(showRelink.id, relinkResidentId);
    if (ok) {
      setShowRelink(null);
      setRelinkResidentId("");
    }
  }

  async function handleAssign(accountId, collectorId) {
    await assignCollectorToAccount(accountId, collectorId);
    setShowAssign(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaUsers className="text-emerald-600" />
            Garbage Accounts
          </h1>
          <p className="text-gray-500 mt-1">
            {garbageAccounts.length} total • {garbageAccounts.filter((a) => a.status === "active").length} active
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-3 rounded-xl font-medium transition"
          >
            <FaSync className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Accounts"}
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-emerald-500/30"
          >
            <FaPlus /> Add Account
          </button>
        </div>
      </div>

      {/* Missing or Unlinked accounts banner */}
      {(missingAccountCount > 0 || unlinkedCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-900">
              {unlinkedCount > 0 && `${unlinkedCount} Unlinked Account${unlinkedCount > 1 ? "s" : ""} detected. `}
              {missingAccountCount > 0 && `${missingAccountCount} participating resident${missingAccountCount > 1 ? "s" : ""} without accounts.`}
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Click "Sync Accounts" to automatically link matching residents, clean phantom records, and sync participation status.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-xl text-sm font-semibold transition shrink-0"
          >
            {syncing ? "Syncing..." : "Sync Accounts Now"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, flat, block..."
              className="w-full border rounded-xl pl-12 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="border rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Resident</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Flat</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Block</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Charge</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Collector</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Status</th>
                <th className="text-center px-6 py-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedAccounts.map((acc) => (
                <tr key={acc.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium">
                    {acc._isUnlinked ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold">
                          Unlinked Account
                        </span>
                        <button
                          onClick={() => {
                            setShowRelink(acc);
                            setRelinkResidentId("");
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                        >
                          Link to Resident
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-gray-900">{acc.residentName}</p>
                        {acc.mobile && <p className="text-xs text-gray-500">{acc.mobile}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">{acc.flat}</td>
                  <td className="px-6 py-4">{acc.block}</td>
                  <td className="px-6 py-4">₹{Number(acc.monthlyCharge || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setShowAssign(acc)}
                      className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                    >
                      <FaUserTie />
                      {acc.collectorName || "Assign"}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleAccountStatus(acc.id, acc.status === "active" ? "inactive" : "active")}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition ${
                        acc.status === "active"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                    >
                      {acc.status === "active" ? <FaToggleOn /> : <FaToggleOff />}
                      {acc.status === "active" ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(acc)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(acc)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6">
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, "all"]}
            />
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editAccount ? "Edit Account" : "Add Garbage Account"}
              </h2>
              <button onClick={() => setShowForm(false)} className="hover:text-red-300">
                <FaTimes className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!editAccount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Resident
                  </label>
                  <select
                    value={form.residentId}
                    onChange={handleResidentSelect}
                    className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Select Resident --</option>
                    {availableResidents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.owner} — {r.flat} ({r.block})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Display resolved resident info (read-only) */}
              {(selectedResident || editAccount) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Resident Details (from master data)</p>
                  <p className="font-medium">{selectedResident?.owner || editAccount?.residentName || "—"}</p>
                  <p className="text-sm text-gray-500">
                    {selectedResident?.flat || editAccount?.flat || "—"} • Block {selectedResident?.block || editAccount?.block || "—"}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Charge (₹)</label>
                <input
                  type="number"
                  value={form.monthlyCharge}
                  onChange={(e) => setForm({ ...form, monthlyCharge: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {editAccount && (
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
              )}

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
                  {editAccount ? "Update" : "Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Collector Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="font-bold text-lg mb-4">
                Assign Collector to {showAssign.residentName}
              </h3>
              <div className="space-y-2">
                {(collectors || []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAssign(showAssign.id, c.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition hover:bg-emerald-50 ${
                      showAssign.collectorId === c.id ? "border-emerald-500 bg-emerald-50" : ""
                    }`}
                  >
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.area || c.email}</p>
                  </button>
                ))}
                {(!collectors || collectors.length === 0) && (
                  <p className="text-gray-400 text-center py-4">No collectors available</p>
                )}
              </div>
              <button
                onClick={() => setShowAssign(null)}
                className="w-full mt-4 px-4 py-2.5 rounded-xl border hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relink Unlinked Account Modal */}
      {showRelink && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg text-gray-900 mb-2">
              Link Account to Resident
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select a canonical resident to link this garbage account to.
              Their current details (name, flat, block) will be dynamically attached.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Choose Resident
                </label>
                <select
                  value={relinkResidentId}
                  onChange={(e) => setRelinkResidentId(e.target.value)}
                  className="w-full border rounded-xl p-3 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Choose Resident --</option>
                  {(residents || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.owner} — Flat {r.flat} ({r.block})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowRelink(null);
                    setRelinkResidentId("");
                  }}
                  className="px-4 py-2 rounded-xl border hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRelink}
                  disabled={!relinkResidentId}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-sm font-semibold transition"
                >
                  Confirm & Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Garbage Account"
          message={`Are you sure you want to delete the garbage account for ${confirmDelete.residentName} (${confirmDelete.flat})?`}
          onConfirm={async () => {
            await deleteAccount(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
