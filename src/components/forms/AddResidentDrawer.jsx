import { FaTimes } from "react-icons/fa";
import ResidentForm from "./ResidentForm";

export default function AddResidentDrawer({
  open,
  resident,
  onClose,
  onSave,
}) {
  if (!open) return null;

  function handleSave(data) {
    onSave(data);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">

        {/* Header */}

        <div className="flex justify-between items-center border-b p-6">

          <div>
            <h2 className="text-2xl font-bold">
              {resident ? "Edit Resident" : "Add Resident"}
            </h2>

            <p className="text-gray-500">
              {resident
                ? "Update resident details"
                : "Enter resident details"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-xl text-gray-500 hover:text-red-600"
          >
            <FaTimes />
          </button>

        </div>

        {/* Form */}

        <div className="p-6">
          <ResidentForm
            resident={resident}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>

      </div>
    </div>
  );
}