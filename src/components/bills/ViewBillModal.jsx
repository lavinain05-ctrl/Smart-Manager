import { FaTimes, FaFileInvoiceDollar, FaCheckCircle, FaClock, FaBan, FaCalendarCheck, FaExclamationTriangle, FaFilePdf } from "react-icons/fa";
import { generateSingleBillPDF } from "../../utils/printReportHelper";

export default function ViewBillModal({ open, bill, onClose, settings = {} }) {
  if (!open || !bill) return null;

  const status = bill.displayStatus || bill.status;

  function handleDownloadPDF() {
    generateSingleBillPDF(bill, settings);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b p-6 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <FaFileInvoiceDollar className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Bill Details</h2>
              <p className="text-sm text-gray-500 font-medium mt-1">
                {bill.month} {bill.year}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-red-600 transition bg-white rounded-full p-2 shadow-sm border"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Status Banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            status === "Paid" ? "bg-green-50 border-green-200 text-green-700"
            : status === "Pending" ? "bg-yellow-50 border-yellow-200 text-yellow-700"
            : status === "Exempted" ? "bg-gray-50 border-gray-200 text-gray-700"
            : status === "Overdue" ? "bg-red-50 border-red-200 text-red-700"
            : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {status === "Paid" ? <FaCheckCircle className="text-2xl" /> 
            : status === "Pending" ? <FaClock className="text-2xl" />
            : status === "Exempted" ? <FaBan className="text-2xl" />
            : status === "Overdue" ? <FaExclamationTriangle className="text-2xl" />
            : <FaClock className="text-2xl" />}
            
            <div>
              <p className="text-sm font-bold uppercase tracking-wider opacity-80">Current Status</p>
              <h3 className="text-xl font-bold">{status}</h3>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            
            <div>
              <p className="text-gray-500 text-sm font-medium">Resident Name</p>
              <p className="text-gray-900 font-bold text-lg">{bill.residentName}</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm font-medium">Flat / Block</p>
              <p className="text-gray-900 font-bold text-lg">{bill.flat} • {bill.block}</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm font-medium">Bill Amount</p>
              <p className="text-emerald-600 font-bold text-xl">₹{Number(bill.amount).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-gray-500 text-sm font-medium">Due Date</p>
              <p className="text-gray-900 font-semibold">{bill.dueDate || "-"}</p>
            </div>

          </div>

          {/* Payment Info (Only shows if Paid/Exempted) */}
          {(status === "Paid" || status === "Exempted") && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
              <h4 className="font-bold text-gray-700 flex items-center gap-2 border-b pb-2">
                <FaCalendarCheck /> Payment Information
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Payment Date</p>
                  <p className="text-gray-900 font-semibold">{bill.paymentDate || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-medium">Method</p>
                  <p className="text-gray-900 font-semibold">{bill.paymentMethod || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-sm font-medium">Receipt / Transaction ID</p>
                  <p className="text-gray-900 font-mono text-sm bg-white p-2 border rounded mt-1">
                    {bill.paymentId || "No Receipt Generated"}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-md shadow-red-600/20 text-sm"
          >
            <FaFilePdf />
            <span>Download PDF Invoice</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2.5 rounded-xl font-bold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}