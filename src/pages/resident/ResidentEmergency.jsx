import { useState, useMemo } from "react";
import {
  FaPhone,
  FaSearch,
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

export default function ResidentEmergency() {
  const { emergencyContacts } = useEmergencyContacts();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return emergencyContacts;
    const s = search.toLowerCase();
    return emergencyContacts.filter((c) =>
      c.name?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.category?.toLowerCase().includes(s)
    );
  }, [emergencyContacts, search]);

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
      <div>
        <h1 className="text-3xl font-bold">Emergency Directory</h1>
        <p className="text-gray-500">Important emergency and utility contacts</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaPhone className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Contacts Available</h2>
          <p className="mt-2">Emergency contacts will be added by the admin.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, contacts]) => (
            <div key={cat}>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {categoryIcons[cat] || categoryIcons.Other}
                {cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="bg-white rounded-2xl shadow-sm border p-4 hover:shadow-md transition">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-sm">{contact.name}</h4>
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
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <FaMapMarkerAlt className="text-[10px]" /> {contact.address}
                      </p>
                    )}
                    {contact.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">{contact.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
