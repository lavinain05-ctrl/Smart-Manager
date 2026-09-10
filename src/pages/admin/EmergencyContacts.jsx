import { useState, useMemo } from "react";
import {
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaPhone,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaFireExtinguisher,
  FaAmbulance,
  FaHospital,
  FaBolt,
  FaTint,
  FaFire,
  FaBuilding,
  FaUserShield,
  FaWrench,
  FaToolbox,
  FaEllipsisH,
  FaClock,
} from "react-icons/fa";

import { useEmergencyContacts } from "../../context/EmergencyContactContext";
import { CONTACT_CATEGORIES } from "../../services/emergencyContactService";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const categoryIcons = {
  "Police": <FaShieldAlt className="text-blue-600" />,
  "Fire Brigade": <FaFireExtinguisher className="text-red-500" />,
  "Ambulance": <FaAmbulance className="text-red-600" />,
  "Hospital": <FaHospital className="text-pink-500" />,
  "Electricity": <FaBolt className="text-yellow-500" />,
  "Water Supply": <FaTint className="text-cyan-500" />,
  "Gas Emergency": <FaFire className="text-orange-500" />,
  "Society Office": <FaBuilding className="text-emerald-500" />,
  "Security Guard": <FaUserShield className="text-indigo-500" />,
  "Plumber": <FaWrench className="text-blue-400" />,
  "Electrician": <FaToolbox className="text-amber-500" />,
  "Other": <FaEllipsisH className="text-gray-400" />,
};

const categoryColors = {
  "Police": "border-blue-200 bg-blue-50",
  "Fire Brigade": "border-red-200 bg-red-50",
  "Ambulance": "border-red-200 bg-red-50",
  "Hospital": "border-pink-200 bg-pink-50",
  "Electricity": "border-yellow-200 bg-yellow-50",
  "Water Supply": "border-cyan-200 bg-cyan-50",
  "Gas Emergency": "border-orange-200 bg-orange-50",
  "Society Office": "border-emerald-200 bg-emerald-50",
  "Security Guard": "border-indigo-200 bg-indigo-50",
  "Plumber": "border-blue-200 bg-blue-50",
  "Electrician": "border-amber-200 bg-amber-50",
  "Other": "border-gray-200 bg-gray-50",
};

export default function EmergencyContacts() {
  const { emergencyContacts, addContact, updateContact, deleteContact } = useEmergencyContacts();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [category, setCategory] = useState("Other");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [is24x7, setIs24x7] = useState(false);

  function resetForm() {
    setName(""); setPhone(""); setAltPhone(""); setCategory("Other");
    setAddress(""); setNotes(""); setIs24x7(false);
    setEditing(null); setShowForm(false);
  }

  function openEdit(contact) {
    setName(contact.name || "");
    setPhone(contact.phone || "");
    setAltPhone(contact.altPhone || "");
    setCategory(contact.category || "Other");
    setAddress(contact.address || "");
    setNotes(contact.notes || "");
    setIs24x7(contact.is24x7 || false);
    setEditing(contact);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    const data = { name: name.trim(), phone: phone.trim(), altPhone, category, address, notes, is24x7 };
    if (editing) {
      await updateContact(editing.id, data);
    } else {
      await addContact(data);
    }
    resetForm();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteContact(confirmDelete.id);
    setConfirmDelete(null);
  }

  const filtered = useMemo(() => {
    if (!search) return emergencyContacts;
    const s = search.toLowerCase();
    return emergencyContacts.filter((c) =>
      c.name?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.category?.toLowerCase().includes(s)
    );
  }, [emergencyContacts, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const cat = c.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Emergency Contacts</h1>
          <p className="text-gray-500">Manage important emergency and utility contacts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus /> Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
      </div>

      {/* Contacts grouped by category */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaPhone className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Emergency Contacts</h2>
          <p className="mt-2">Add important emergency numbers for the society.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, contacts]) => (
            <div key={cat}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {categoryIcons[cat] || categoryIcons.Other}
                {cat}
                <span className="text-xs font-normal text-gray-400">({contacts.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition ${categoryColors[cat] || categoryColors.Other}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-sm truncate">{contact.name}</h4>
                          {contact.is24x7 && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold flex items-center gap-0.5">
                              <FaClock className="text-[8px]" /> 24/7
                            </span>
                          )}
                        </div>
                        <a href={`tel:${contact.phone}`} className="text-blue-600 font-mono text-sm font-bold hover:underline flex items-center gap-1">
                          <FaPhone className="text-xs" /> {contact.phone}
                        </a>
                        {contact.altPhone && (
                          <a href={`tel:${contact.altPhone}`} className="text-gray-500 font-mono text-xs hover:underline flex items-center gap-1 mt-0.5">
                            <FaPhone className="text-[10px]" /> {contact.altPhone}
                          </a>
                        )}
                        {contact.address && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <FaMapMarkerAlt className="text-[10px]" /> {contact.address}
                          </p>
                        )}
                        {contact.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">{contact.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => openEdit(contact)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/80 text-blue-500 hover:bg-blue-50 transition text-xs">
                          <FaEdit />
                        </button>
                        <button onClick={() => setConfirmDelete(contact)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/80 text-red-500 hover:bg-red-50 transition text-xs">
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editing ? "Edit Contact" : "Add Emergency Contact"}</h2>
              <button onClick={resetForm} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block mb-2 font-medium">Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" required />
              </div>
              <div>
                <label className="block mb-2 font-medium">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none">
                  {CONTACT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Phone <span className="text-red-500">*</span></label>
                  <input type="tel" placeholder="Primary number" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" required />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Alt Phone</label>
                  <input type="tel" placeholder="Alternate" value={altPhone} onChange={(e) => setAltPhone(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium">Address</label>
                <input type="text" placeholder="Location / area" value={address} onChange={(e) => setAddress(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="block mb-2 font-medium">Notes</label>
                <textarea placeholder="Additional details..." value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={2} className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={is24x7} onChange={(e) => setIs24x7(e.target.checked)}
                  className="w-4 h-4 rounded text-red-500 focus:ring-red-500" />
                <span className="font-medium text-sm">Available 24/7</span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold transition">
                  {loading ? "Saving..." : editing ? "Update" : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Contact"
          message={`Delete "${confirmDelete.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
