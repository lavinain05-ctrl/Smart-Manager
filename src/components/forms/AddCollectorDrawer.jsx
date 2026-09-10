import { FaTimes } from "react-icons/fa";
import CollectorForm from "./CollectorForm";

export default function AddCollectorDrawer({
  open,
  collector,
  onClose,
  onSave,
}) {
  if (!open) return null;

  function handleSave(data) {
    onSave(data);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">

        {/* Header */}

        <div className="flex justify-between items-center border-b p-6">

          <div>
            <h2 className="text-2xl font-bold">
              {collector ? "Edit Collector" : "Add Collector"}
            </h2>

            <p className="text-gray-500">
              {collector
                ? "Update collector details"
                : "Enter collector details"}
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
          <CollectorForm
            collector={collector}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>

      </div>
    </div>
  );
}