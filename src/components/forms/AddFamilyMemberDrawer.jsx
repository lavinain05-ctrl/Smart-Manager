import { FaTimes, FaUserFriends } from "react-icons/fa";
import FamilyMemberForm from "./FamilyMemberForm";

export default function AddFamilyMemberDrawer({
  open,
  familyMember,
  onClose,
  onSave,
  preselectedResidentId,
}) {
  if (!open) return null;

  function handleSave(data) {
    return onSave(data);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b p-6 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <FaUserFriends className="text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {familyMember ? "Edit Family Member" : "Add Family Member"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {familyMember
                  ? "Update family member details and login access"
                  : "Create an independent resident portal account for a family member"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-gray-100 transition"
          >
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 flex-1">
          <FamilyMemberForm
            familyMember={familyMember}
            onSave={handleSave}
            onCancel={onClose}
            preselectedResidentId={preselectedResidentId}
          />
        </div>
      </div>
    </div>
  );
}
