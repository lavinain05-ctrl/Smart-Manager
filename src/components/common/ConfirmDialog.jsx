import { FaExclamationTriangle } from "react-icons/fa";

export default function ConfirmDialog({
  open = true,
  isOpen,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText,
}) {
  const isVisible = isOpen !== undefined ? isOpen : open;
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-2xl w-full max-w-md p-6">

        <div className="flex items-center gap-3">

          <FaExclamationTriangle className="text-3xl text-red-500" />

          <h2 className="text-xl font-bold">
            {title}
          </h2>

        </div>

        <p className="text-gray-500 mt-4">
          {message}
        </p>

        <div className="flex justify-end gap-3 mt-8">

          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-xl border"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
          >
            {confirmText || "Delete"}
          </button>

        </div>

      </div>

    </div>
  );
}