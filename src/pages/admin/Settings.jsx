import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaCog,
  FaBuilding,
  FaUniversity,
  FaInfoCircle,
  FaFileAlt,
  FaPhone,
  FaTrash,
  FaSave,
  FaSpinner,
  FaUserShield,
  FaCheckCircle,
  FaExchangeAlt,
  FaMapMarkerAlt,
  FaClock,
  FaEnvelope,
  FaCreditCard,
} from "react-icons/fa";

import toast from "react-hot-toast";

import ThemeCard from "../../components/settings/ThemeCard";
import BackupCard from "../../components/settings/BackupCard";

import { useSettings } from "../../context/SettingsContext";
import { useAuth } from "../../context/AuthContext";
import { auth, db } from "../../firebase/firebase";
import { updateEmail } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  mobileToAuthEmail,
  writeAuthLookup,
  normalizeMobile,
  AUTH_EMAIL_DOMAIN,
} from "../../services/authService";

const TABS = [
  { key: "general", label: "General", icon: <FaCog /> },
  { key: "office", label: "Office & Contact", icon: <FaBuilding /> },
  { key: "bank", label: "Bank Details", icon: <FaUniversity /> },
  { key: "society", label: "Society Rules", icon: <FaFileAlt /> },
  { key: "system", label: "System", icon: <FaInfoCircle /> },
];

export default function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : "general"
  );
  const [saving, setSaving] = useState(false);

  // Sync tab with URL search parameter changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((t) => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchParams({ tab: key });
  };

  const [form, setForm] = useState({
    societyName: "",
    address: "",
    monthlyCharge: "",
    collectorTiming: "",
    contactNumber: "",
    officeTiming: "",
    supportEmail: "",
    supportPhone: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    bankBranch: "",
    upiId: "",
    societyRules: "",
    codeOfConduct: "",
    googleMapUrl: "",
  });

  // Admin migration state
  const [migrateMobile, setMigrateMobile] = useState("");
  const [migrateLoading, setMigrateLoading] = useState(false);

  // Populate form when settings load from Firestore
  useEffect(() => {
    if (!loading && settings) {
      setForm({
        societyName: settings.societyName || "",
        address: settings.address || "",
        monthlyCharge: settings.monthlyCharge ?? "",
        collectorTiming: settings.collectorTiming || "",
        contactNumber: settings.contactNumber || "",
        officeTiming: settings.officeTiming || "",
        supportEmail: settings.supportEmail || "",
        supportPhone: settings.supportPhone || "",
        bankName: settings.bankName || "",
        bankAccount: settings.bankAccount || "",
        bankIfsc: settings.bankIfsc || "",
        bankBranch: settings.bankBranch || "",
        upiId: settings.upiId || "",
        societyRules: settings.societyRules || "",
        codeOfConduct: settings.codeOfConduct || "",
        googleMapUrl: settings.googleMapUrl || "",
      });
    }
  }, [loading, settings]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        ...form,
        monthlyCharge: Number(form.monthlyCharge) || 0,
      });
    } finally {
      setSaving(false);
    }
  }

  // =============================
  // Admin Mobile Migration
  // =============================
  async function handleMigrateToMobile() {
    const cleanMobile = normalizeMobile(migrateMobile);
    if (!cleanMobile || cleanMobile.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }

    setMigrateLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("You must be logged in to migrate.");
        setMigrateLoading(false);
        return;
      }

      const newPseudoEmail = mobileToAuthEmail(cleanMobile);

      // 1. Update Firebase Auth email
      await updateEmail(currentUser, newPseudoEmail);

      // 2. Update Firestore users/{uid}
      await updateDoc(doc(db, "users", currentUser.uid), {
        phone: cleanMobile,
        email: newPseudoEmail,
        updatedAt: serverTimestamp(),
      });

      // 3. Write centralized auth lookup mapping
      await writeAuthLookup(cleanMobile, newPseudoEmail, currentUser.uid);

      toast.success(`Admin login migrated! Log out and sign in with mobile ${cleanMobile}.`);
      setMigrateMobile("");
    } catch (error) {
      console.error("[MigrateAdmin]", error);
      if (error.code === "auth/requires-recent-login") {
        toast.error("Please log out and log in again, then try migration immediately.");
      } else if (error.code === "auth/email-already-in-use") {
        toast.error("This mobile number is already in use by another account.");
      } else {
        toast.error(error.message || "Migration failed.");
      }
    } finally {
      setMigrateLoading(false);
    }
  }

  function InputField({ label, name, type = "text", placeholder, hint, prefix, icon: Icon }) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
        {hint && <p className="text-gray-400 text-xs">{hint}</p>}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              <Icon />
            </div>
          )}
          {prefix && !Icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            type={type}
            name={name}
            placeholder={placeholder}
            value={form[name]}
            onChange={handleChange}
            className={`w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white ${
              Icon || prefix ? "pl-10" : ""
            }`}
          />
        </div>
      </div>
    );
  }

  function TextAreaField({ label, name, placeholder, rows = 4, hint }) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
        {hint && <p className="text-gray-400 text-xs">{hint}</p>}
        <textarea
          name={name}
          placeholder={placeholder}
          value={form[name]}
          onChange={handleChange}
          rows={rows}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white resize-y"
        />
      </div>
    );
  }

  // Check if admin is currently using mobile-based auth
  const isAlreadyMobile = user?.email?.endsWith(`@${AUTH_EMAIL_DOMAIN}`);
  const currentMobileNumber = isAlreadyMobile ? user.email.split("@")[0] : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage society configuration, contact numbers, banking details, and system options.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* NON-SYSTEM TABS (GENERAL, OFFICE, BANK, SOCIETY RULES)    */}
      {/* ======================================================== */}
      {activeTab !== "system" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">General Information</h2>
                <p className="text-xs text-gray-500">Core details displayed on resident receipts, notices, and portal headers.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <InputField
                    label="Society Name"
                    name="societyName"
                    placeholder="e.g. D Block RWA Indraprastha"
                  />
                </div>

                <div className="md:col-span-2">
                  <InputField
                    label="Full Society Address"
                    name="address"
                    placeholder="e.g. D-Block, Indraprastha Colony, Sector 3"
                    icon={FaMapMarkerAlt}
                  />
                </div>

                <InputField
                  label="Default Monthly Charge"
                  name="monthlyCharge"
                  type="number"
                  placeholder="e.g. 200"
                  prefix="₹"
                  hint="Initial maintenance fee pre-filled when adding a resident."
                />

                <InputField
                  label="Garbage Collector Timing"
                  name="collectorTiming"
                  placeholder="e.g. 7:00 AM - 10:30 AM"
                  icon={FaClock}
                  hint="Daily garbage pickup window."
                />

                <InputField
                  label="Primary Contact Number"
                  name="contactNumber"
                  placeholder="e.g. 9876543210"
                  icon={FaPhone}
                />

                <InputField
                  label="Google Maps Location URL"
                  name="googleMapUrl"
                  placeholder="https://maps.google.com/?q=..."
                  icon={FaMapMarkerAlt}
                  hint="Link for residents to find the RWA gate/office."
                />
              </div>
            </div>
          )}

          {/* Office & Contact Tab */}
          {activeTab === "office" && (
            <div className="space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">Office Hours & Helpdesk</h2>
                <p className="text-xs text-gray-500">Official hours and support contact details for residents.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField
                  label="RWA Office Timing"
                  name="officeTiming"
                  placeholder="e.g. Mon - Sat: 9:00 AM - 6:00 PM"
                  icon={FaClock}
                />

                <InputField
                  label="Support Helpline Phone"
                  name="supportPhone"
                  placeholder="e.g. 011-23456789"
                  icon={FaPhone}
                />

                <InputField
                  label="Support Email Address"
                  name="supportEmail"
                  type="email"
                  placeholder="support@society.com"
                  icon={FaEnvelope}
                />

                <InputField
                  label="Office Landline / Desk Phone"
                  name="contactNumber"
                  placeholder="e.g. 011-23456780"
                  icon={FaPhone}
                />
              </div>
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === "bank" && (
            <div className="space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">Bank & Payment Details</h2>
                <p className="text-xs text-gray-500">Official RWA account used for NEFT, IMPS, and direct UPI maintenance collection.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField
                  label="Bank Name"
                  name="bankName"
                  placeholder="e.g. State Bank of India"
                  icon={FaUniversity}
                />

                <InputField
                  label="Account Number"
                  name="bankAccount"
                  placeholder="e.g. 38472910482"
                  icon={FaCreditCard}
                />

                <InputField
                  label="IFSC Code"
                  name="bankIfsc"
                  placeholder="e.g. SBIN0001234"
                />

                <InputField
                  label="Branch Name"
                  name="bankBranch"
                  placeholder="e.g. Sector 62 Branch"
                />

                <div className="md:col-span-2">
                  <InputField
                    label="Official UPI ID (VPA)"
                    name="upiId"
                    placeholder="e.g. rwa.indraprastha@sbi"
                    hint="Residents can scan and pay maintenance directly to this UPI address."
                  />
                  {form.upiId && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold">
                      <FaCheckCircle className="text-emerald-500" /> Active UPI: {form.upiId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Society Rules Tab */}
          {activeTab === "society" && (
            <div className="space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">Rules & Code of Conduct</h2>
                <p className="text-xs text-gray-500">Guidelines displayed in the Resident Portal for all society members.</p>
              </div>

              <TextAreaField
                label="Society By-Laws & General Rules"
                name="societyRules"
                placeholder="1. Waste segregation is mandatory (wet and dry).&#10;2. Parking allowed only in designated slots.&#10;3. Quiet hours 10:00 PM to 6:00 AM..."
                rows={6}
                hint="Key community rules for all residents."
              />

              <TextAreaField
                label="Code of Conduct"
                name="codeOfConduct"
                placeholder="Guidelines for respectful behavior towards staff, neighbors, and common facilities..."
                rows={5}
                hint="Expected conduct inside society premises."
              />
            </div>
          )}

          {/* Save Button for form tabs */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              Changes are saved to the cloud and update instantly across all portals.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm"
            >
              {saving ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FaSave className="text-sm" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SYSTEM TAB (ADMIN SECURITY, THEME, BACKUP, DANGER ZONE)  */}
      {/* ======================================================== */}
      {activeTab === "system" && (
        <div className="space-y-6">
          {/* 1. Admin Account & Login */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                  <FaUserShield />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Admin Account & Access
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Manage your administrator login credentials and authentication method.
                  </p>
                </div>
              </div>

              {isAlreadyMobile ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FaCheckCircle className="text-emerald-500" /> Mobile Login Active ({currentMobileNumber})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Email Login Active
                </span>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200/70 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Logged in as:</p>
                <p className="font-semibold text-gray-800">{user?.displayName || "Administrator"}</p>
                <p className="text-gray-500 text-xs mt-0.5">{user?.email}</p>
              </div>
              <div className="text-xs text-gray-500">
                Role: <span className="font-semibold text-emerald-700">Full Administrator</span>
              </div>
            </div>

            {/* Optional switch to mobile login for email users */}
            {!isAlreadyMobile && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <FaExchangeAlt className="text-emerald-600" /> Switch to Mobile Number Login (Optional)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Link your 10-digit mobile number so you can log in using your phone number instead of email. Your password remains unchanged.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                      +91
                    </span>
                    <input
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={migrateMobile}
                      onChange={(e) => setMigrateMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full pl-12 border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      maxLength={10}
                    />
                  </div>
                  <button
                    onClick={handleMigrateToMobile}
                    disabled={migrateLoading || migrateMobile.length !== 10}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm transition whitespace-nowrap"
                  >
                    {migrateLoading ? "Updating..." : "Update Login"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Theme & Appearance */}
          <ThemeCard />

          {/* 3. Real Working Data Backup & Export */}
          <BackupCard />

          {/* 4. Danger Zone: Reset Test Data */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-lg">
                <FaTrash />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-800">
                  Danger Zone: Reset Test Data
                </h3>
                <p className="text-xs text-red-600">
                  Permanently delete test records (residents, committee members, collectors, bills, and payments).
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-700">
              Admin credentials, building blocks, flats, and society settings will be preserved safely.
            </p>

            <div className="pt-2">
              <button
                onClick={() => navigate("/admin/reset-data")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition shadow-sm"
              >
                <FaTrash className="text-xs" />
                <span>Open Test Data Reset Tool</span>
              </button>
            </div>
          </div>

          {/* Clean system footer */}
          <div className="text-center pt-2 pb-6">
            <p className="text-xs text-gray-400 font-medium">
              D Block RWA Indraprastha Management Portal • Version 2.0
            </p>
          </div>
        </div>
      )}
    </div>
  );
}