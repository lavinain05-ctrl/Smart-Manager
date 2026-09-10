import { FaTimes, FaUserTie } from "react-icons/fa";
import CommitteeForm from "./CommitteeForm";

export default function AddCommitteeDrawer({
  open,
  member,
  onClose,
  onSave,
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
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
              <FaUserTie className="text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {member ? "Edit Committee Member" : "Add Committee Member"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {member
                  ? "Update official profile, designation, and governance role"
                  : "Create an official administrative account for an RWA committee member"}
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
          <CommitteeForm
            member={member}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
