import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaBuilding,
  FaClock,
  FaSignOutAlt,
  FaTimesCircle,
  FaCheckCircle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isRejected = user?.status === "rejected";

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">

        {/* Logo */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-lg">
          <FaBuilding />
        </div>

        <h1 className="text-2xl font-bold mt-5">Smart Manager</h1>

        {isRejected ? (
          <>
            {/* Rejected */}
            <div className="mt-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
                <FaTimesCircle className="text-red-500 text-4xl" />
              </div>

              <h2 className="text-xl font-bold text-red-600">
                Registration Rejected
              </h2>

              <p className="text-gray-500 mt-3 leading-relaxed">
                Your registration has been rejected by the admin.
              </p>

              {user?.rejectionReason && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-left">
                  <strong>Reason:</strong> {user.rejectionReason}
                </div>
              )}

              <p className="text-gray-400 text-sm mt-4">
                Please contact the society admin for more information.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Pending Approval */}
            <div className="mt-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                <FaClock className="text-yellow-500 text-4xl animate-pulse" />
              </div>

              <h2 className="text-xl font-bold text-yellow-600">
                Pending Approval
              </h2>

              <p className="text-gray-500 mt-3 leading-relaxed">
                Your registration is being reviewed by the society admin.
                You will receive access once approved.
              </p>

              <div className="mt-6 bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
                {user?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name</span>
                    <span className="font-medium">{user.name}</span>
                  </div>
                )}
                {user?.mobile && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mobile</span>
                    <span className="font-medium">{user.mobile}</span>
                  </div>
                )}
                {user?.flat && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Flat</span>
                    <span className="font-medium">{user.flat}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-8 flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition"
        >
          <FaSignOutAlt /> Logout
        </button>
      </div>
    </div>
  );
}
