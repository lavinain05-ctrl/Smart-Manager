import React, { Suspense, lazy as reactLazy, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getHomeRouteForRole } from "../services/authService";

// Safe dynamic lazy import that automatically purges caches and refreshes
// when a deployment updates chunk hashes, eliminating "Failed to fetch dynamically imported module"
function lazy(importFn) {
  return reactLazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      console.warn("[AppRoutes] Dynamic chunk import failed:", err);
      const isChunkError =
        err?.message?.includes("Failed to fetch dynamically imported module") ||
        err?.message?.includes("Expected a JavaScript-or-Wasm module script") ||
        err?.message?.includes("error loading dynamically imported module") ||
        (err?.message?.includes("text/html") && err?.message?.includes("MIME")) ||
        err?.message?.includes("text/plain") ||
        err?.message?.includes("404") ||
        err?.message?.includes("Loading chunk") ||
        err?.name === "TypeError";

      if (isChunkError) {
        const lastReload = sessionStorage.getItem("rwa_chunk_retry");
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 15000) {
          sessionStorage.setItem("rwa_chunk_retry", String(now));
          if (typeof window !== "undefined" && "caches" in window) {
            try {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map((k) => caches.delete(k)));
            } catch {}
          }
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });
}

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
const PendingApproval = lazy(() => import("../pages/auth/PendingApproval"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const ForceChangePassword = lazy(() => import("../pages/auth/ForceChangePassword"));

const PublicNotice = lazy(() => import("../pages/public/PublicNotice"));
const PublicEvent = lazy(() => import("../pages/public/PublicEvent"));
const PublicSpecialCollection = lazy(() => import("../pages/public/PublicSpecialCollection"));

import MainLayout from "../components/layout/MainLayout";

const Dashboard = lazy(() => import("../pages/admin/Dashboard"));
const Residents = lazy(() => import("../pages/admin/Residents"));
const SpecialCollections = lazy(() => import("../pages/admin/SpecialCollections"));
const Collections = lazy(() => import("../pages/admin/Collections"));
const Collectors = lazy(() => import("../pages/admin/Collectors"));
const Settings = lazy(() => import("../pages/admin/Settings"));
const PaymentHistory = lazy(() => import("../pages/admin/PaymentHistory"));
const Receipts = lazy(() => import("../pages/admin/Receipts"));
const Bills = lazy(() => import("../pages/admin/Bills"));
const CollectorDailyReport = lazy(() => import("../pages/admin/CollectorDailyReport"));
const Notices = lazy(() => import("../pages/admin/Notices"));
const Complaints = lazy(() => import("../pages/admin/Complaints"));
const Suggestions = lazy(() => import("../pages/admin/Suggestions"));
const Events = lazy(() => import("../pages/admin/Events"));
const PendingRegistrations = lazy(() => import("../pages/admin/PendingRegistrations"));
const ManageFamilyMembers = lazy(() => import("../pages/admin/ManageFamilyMembers"));
const ManageCommittee = lazy(() => import("../pages/admin/ManageCommittee"));
const ProfileRequests = lazy(() => import("../pages/admin/ProfileRequests"));
const BlocksAndFlats = lazy(() => import("../pages/admin/BlocksAndFlats"));
const Activities = lazy(() => import("../pages/admin/Activities"));
const ActivityLogs = lazy(() => import("../pages/admin/ActivityLogs"));
const ActiveDevices = lazy(() => import("../pages/admin/ActiveDevices"));
const EmergencyContacts = lazy(() => import("../pages/admin/EmergencyContacts"));
const RegistrationRequests = lazy(() => import("../pages/admin/RegistrationRequests"));
const DeletedAccounts = lazy(() => import("../pages/admin/DeletedAccounts"));
const BlockedAccounts = lazy(() => import("../pages/admin/BlockedAccounts"));
const ResetData = lazy(() => import("../pages/admin/ResetData"));
const AccountRecovery = lazy(() => import("../pages/admin/AccountRecovery"));
const ManageSupport = lazy(() => import("../pages/admin/ManageSupport"));

const GarbageDashboard = lazy(() => import("../pages/admin/GarbageDashboard"));
const GarbageCollectors = lazy(() => import("../pages/admin/GarbageCollectors"));
const GarbageReports = lazy(() => import("../pages/admin/GarbageReports"));
const GarbageRequests = lazy(() => import("../pages/admin/GarbageRequests"));
const GarbageSettings = lazy(() => import("../pages/admin/GarbageSettings"));

import CollectorLayout from "../components/layout/CollectorLayout";
const CollectorDashboard = lazy(() => import("../pages/collector/CollectorDashboard"));
const CollectorCollect = lazy(() => import("../pages/collector/CollectorCollect"));
const CollectorHistory = lazy(() => import("../pages/collector/CollectorHistory"));

const GarbageCollectorDashboard = lazy(() => import("../pages/collector/GarbageCollectorDashboard"));
const GarbageCollectorCollect = lazy(() => import("../pages/collector/GarbageCollectorCollect"));
const GarbageCollectorHistory = lazy(() => import("../pages/collector/GarbageCollectorHistory"));

import ResidentLayout from "../components/layout/ResidentLayout";
const ResidentDashboard = lazy(() => import("../pages/resident/ResidentDashboard"));
const ResidentBills = lazy(() => import("../pages/resident/ResidentBills"));
const ResidentPayments = lazy(() => import("../pages/resident/ResidentPayments"));
const ResidentReceipts = lazy(() => import("../pages/resident/ResidentReceipts"));
const ResidentNotices = lazy(() => import("../pages/resident/ResidentNotices"));
const ResidentProfile = lazy(() => import("../pages/resident/ResidentProfile"));
const ResidentComplaints = lazy(() => import("../pages/resident/ResidentComplaints"));
const ResidentSuggestions = lazy(() => import("../pages/resident/ResidentSuggestions"));
const ResidentEvents = lazy(() => import("../pages/resident/ResidentEvents"));
const ResidentActivities = lazy(() => import("../pages/resident/ResidentActivities"));
const ResidentEmergency = lazy(() => import("../pages/resident/ResidentEmergency"));
const ResidentGarbage = lazy(() => import("../pages/resident/ResidentGarbage"));
const ResidentCommittee = lazy(() => import("../pages/resident/ResidentCommittee"));
const ResidentSpecialCollections = lazy(() => import("../pages/resident/ResidentSpecialCollections"));
const ResidentSupport = lazy(() => import("../pages/resident/ResidentSupport"));

import ProtectedRoute from "../pages/auth/ProtectedRoute";
import AdminRoute from "../pages/auth/AdminRoute";
import CollectorRoute from "../pages/auth/CollectorRoute";
import ResidentRoute from "../pages/auth/ResidentRoute";
import FamilyRoute from "../pages/auth/FamilyRoute";

import FamilyLayout from "../components/layout/FamilyLayout";
const FamilyDashboard = lazy(() => import("../pages/family/FamilyDashboard"));

import CommitteeRoute from "../pages/auth/CommitteeRoute";
import CommitteeLayout from "../components/layout/CommitteeLayout";
const CommitteeDashboard = lazy(() => import("../pages/committee/CommitteeDashboard"));
const CommitteeGarbage = lazy(() => import("../pages/committee/CommitteeGarbage"));
const CommitteeCollect = lazy(() => import("../pages/committee/CommitteeCollect"));
const CommitteeCollectionHistory = lazy(() => import("../pages/committee/CommitteeCollectionHistory"));
import ImpersonationBanner from "../components/common/ImpersonationBanner";
import ImpersonatedMobileFrame from "../components/common/ImpersonatedMobileFrame";
import { useAuth } from "../context/AuthContext";

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span className="text-xs text-slate-400 font-semibold tracking-wide">Loading page...</span>
      </div>
    </div>
  );
}

function CommitteeCollectorRouteGuard({ children }) {
  const { user } = useAuth();
  const canCollect = Boolean(
    user?.role === "admin" ||
    user?.canCollectGarbage ||
    user?.permissions?.canCollectGarbage ||
    user?.canCollectSpecial ||
    user?.permissions?.canCollectSpecial
  );

  if (!canCollect) {
    return <Navigate to="/committee/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const { user, isImpersonating, impersonatedDeviceMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    sessionStorage.setItem("rwa_session_active", "true");
    // If authenticated user lands on login or root routes, immediately navigate to their portal
    if (user && user.role) {
      const homeRoute = getHomeRouteForRole(user.role);
      const isAuthRoute =
        location.pathname === "/" ||
        location.pathname === "/login" ||
        location.pathname === "/resident/login";
      if (homeRoute && isAuthRoute) {
        navigate(homeRoute, { replace: true });
      }
    }
  }, [user, navigate, location.pathname]);

  const isInsideFrame =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      new URLSearchParams(window.location.search).has("simulated_frame"));

  if (isImpersonating && impersonatedDeviceMode === "mobile" && !isInsideFrame) {
    return (
      <>
        <ImpersonationBanner />
        <ImpersonatedMobileFrame />
      </>
    );
  }

  return (
    <>
      <ImpersonationBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>

        {/* Login Routes */}

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/resident/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ForceChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pending-approval"
          element={<PendingApproval />}
        />

        {/* Public Share Routes (no auth required) */}

        <Route
          path="/share/notice/:noticeId"
          element={<PublicNotice />}
        />

        <Route
          path="/share/event/:eventId"
          element={<PublicEvent />}
        />

        <Route
          path="/public/collections/:id"
          element={<PublicSpecialCollection />}
        />

        {/* Admin Routes */}

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <MainLayout />
            </AdminRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/admin/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="registrations"
            element={<RegistrationRequests />}
          />

          <Route
            path="residents"
            element={<Residents />}
          />

          <Route
            path="blocks-flats"
            element={<BlocksAndFlats />}
          />

          <Route
            path="pending-registrations"
            element={<PendingRegistrations />}
          />

          <Route
            path="family-members"
            element={<ManageFamilyMembers />}
          />

          <Route
            path="profile-requests"
            element={<ProfileRequests />}
          />

          <Route
            path="bills"
            element={<Bills />}
          />

          <Route
            path="collections"
            element={<Collections />}
          />

          <Route
            path="special-collections"
            element={<SpecialCollections />}
          />

          <Route
            path="collectors"
            element={<Collectors />}
          />

          <Route
            path="collector-daily-report"
            element={<CollectorDailyReport />}
          />

          <Route
            path="notices"
            element={<Notices />}
          />

          <Route
            path="complaints"
            element={<Complaints />}
          />

          <Route
            path="suggestions"
            element={<Suggestions />}
          />

          <Route
            path="events"
            element={<Events />}
          />

          <Route
            path="activities"
            element={<Activities />}
          />

          <Route
            path="committee"
            element={<ManageCommittee />}
          />

          <Route
            path="reports"
            element={<Navigate to="/admin/garbage/reports" replace />}
          />

          <Route
            path="payment-history"
            element={<PaymentHistory />}
          />

          <Route
            path="receipts"
            element={<Receipts />}
          />

          <Route
            path="activity-logs"
            element={<ActivityLogs />}
          />

          <Route
            path="devices"
            element={<ActiveDevices />}
          />

          <Route
            path="active-sessions"
            element={<ActiveDevices />}
          />

          <Route
            path="emergency-contacts"
            element={<EmergencyContacts />}
          />

          <Route
            path="settings"
            element={<Settings />}
          />

          <Route
            path="support"
            element={<ManageSupport />}
          />

          <Route
            path="deleted-accounts"
            element={<DeletedAccounts />}
          />

          <Route
            path="blocked-accounts"
            element={<BlockedAccounts />}
          />

          <Route
            path="account-recovery"
            element={<AccountRecovery />}
          />

          <Route
            path="reset-data"
            element={<ResetData />}
          />

          {/* Garbage Collection Routes */}
          <Route
            path="garbage/dashboard"
            element={<GarbageDashboard />}
          />
          <Route
            path="garbage/accounts"
            element={<Navigate to="/admin/garbage/dashboard" replace />}
          />
          <Route
            path="garbage/bills"
            element={<Navigate to="/admin/bills" replace />}
          />
          <Route
            path="garbage/collections"
            element={<Navigate to="/admin/collections" replace />}
          />
          <Route
            path="garbage/payment-history"
            element={<Navigate to="/admin/payment-history" replace />}
          />
          <Route
            path="garbage/receipts"
            element={<Navigate to="/admin/receipts" replace />}
          />
          <Route
            path="garbage/daily-report"
            element={<Navigate to="/admin/collector-daily-report" replace />}
          />
          <Route
            path="garbage/collectors"
            element={<GarbageCollectors />}
          />
          <Route
            path="garbage/reports"
            element={<GarbageReports />}
          />
          <Route
            path="garbage/requests"
            element={<GarbageRequests />}
          />
          <Route
            path="garbage/settings"
            element={<GarbageSettings />}
          />
        </Route>

        {/* Collector Routes */}

        <Route
          path="/collector"
          element={
            <CollectorRoute>
              <CollectorLayout />
            </CollectorRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/collector/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<CollectorDashboard />}
          />

          <Route
            path="collect"
            element={<CollectorCollect />}
          />

          <Route
            path="history"
            element={<CollectorHistory />}
          />

          {/* Garbage Collection Routes */}
          <Route
            path="garbage/dashboard"
            element={<GarbageCollectorDashboard />}
          />
          <Route
            path="garbage/collect"
            element={<GarbageCollectorCollect />}
          />
          <Route
            path="garbage/history"
            element={<GarbageCollectorHistory />}
          />
          <Route
            path="profile"
            element={<ResidentProfile />}
          />
        </Route>

        {/* Resident Routes */}

        <Route
          path="/resident"
          element={
            <ResidentRoute>
              <ResidentLayout />
            </ResidentRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/resident/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<ResidentDashboard />}
          />

          <Route
            path="bills"
            element={<ResidentBills />}
          />

          <Route
            path="payments"
            element={<ResidentPayments />}
          />

          <Route
            path="receipts"
            element={<ResidentReceipts />}
          />

          <Route
            path="notices"
            element={<ResidentNotices />}
          />

          <Route
            path="complaints"
            element={<ResidentComplaints />}
          />

          <Route
            path="suggestions"
            element={<ResidentSuggestions />}
          />

          <Route
            path="events"
            element={<ResidentEvents />}
          />

          <Route
            path="activities"
            element={<ResidentActivities />}
          />

          <Route
            path="emergency"
            element={<ResidentEmergency />}
          />

          <Route
            path="garbage"
            element={<ResidentGarbage />}
          />

          <Route
            path="special-collections"
            element={<ResidentSpecialCollections />}
          />

          <Route
            path="committee"
            element={<ResidentCommittee />}
          />

          <Route
            path="profile"
            element={<ResidentProfile />}
          />

          <Route
            path="support"
            element={<ResidentSupport />}
          />
        </Route>

        {/* Family Routes */}

        <Route
          path="/family"
          element={
            <FamilyRoute>
              <FamilyLayout />
            </FamilyRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/family/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<FamilyDashboard />}
          />

          <Route
            path="bills"
            element={<ResidentBills />}
          />

          <Route
            path="receipts"
            element={<ResidentReceipts />}
          />

          <Route
            path="notices"
            element={<ResidentNotices />}
          />

          <Route
            path="complaints"
            element={<ResidentComplaints />}
          />

          <Route
            path="events"
            element={<ResidentEvents />}
          />

          <Route
            path="activities"
            element={<ResidentActivities />}
          />

          <Route
            path="emergency"
            element={<ResidentEmergency />}
          />

          <Route
            path="garbage"
            element={<ResidentGarbage />}
          />

          <Route
            path="special-collections"
            element={<ResidentSpecialCollections />}
          />

          <Route
            path="committee"
            element={<ResidentCommittee />}
          />

          <Route
            path="profile"
            element={<ResidentProfile />}
          />

          <Route
            path="support"
            element={<ResidentSupport />}
          />
        </Route>

        {/* Committee Routes */}

        <Route
          path="/committee"
          element={
            <CommitteeRoute>
              <CommitteeLayout />
            </CommitteeRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/committee/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<CommitteeDashboard />}
          />

          <Route
            path="notices"
            element={<ResidentNotices />}
          />

          <Route
            path="events"
            element={<ResidentEvents />}
          />

          <Route
            path="activities"
            element={<ResidentActivities />}
          />

          <Route
            path="complaints"
            element={<ResidentComplaints />}
          />

          <Route
            path="directory"
            element={<ResidentCommittee />}
          />
          <Route
            path="committee"
            element={<ResidentCommittee />}
          />
          <Route
            path="members"
            element={<ResidentCommittee />}
          />

          <Route
            path="emergency"
            element={<ResidentEmergency />}
          />

          <Route
            path="garbage"
            element={<CommitteeGarbage />}
          />

          <Route
            path="special-collections"
            element={<ResidentSpecialCollections />}
          />

          {/* Delegated Management Routes */}
          <Route
            path="residents"
            element={<Residents />}
          />
          <Route
            path="collectors"
            element={<Collectors />}
          />
          <Route
            path="registrations"
            element={<RegistrationRequests />}
          />
          <Route
            path="profile-requests"
            element={<ProfileRequests />}
          />
          <Route
            path="account-recovery"
            element={<AccountRecovery />}
          />
          <Route
            path="collect"
            element={
              <CommitteeCollectorRouteGuard>
                <CommitteeCollect />
              </CommitteeCollectorRouteGuard>
            }
          />
          <Route
            path="collect-garbage"
            element={
              <CommitteeCollectorRouteGuard>
                <CommitteeCollect defaultModule="garbage" />
              </CommitteeCollectorRouteGuard>
            }
          />
          <Route
            path="collect-special"
            element={
              <CommitteeCollectorRouteGuard>
                <CommitteeCollect defaultModule="special_collections" />
              </CommitteeCollectorRouteGuard>
            }
          />
          <Route
            path="history"
            element={
              <CommitteeCollectorRouteGuard>
                <CommitteeCollectionHistory />
              </CommitteeCollectorRouteGuard>
            }
          />

          <Route
            path="profile"
            element={<ResidentProfile />}
          />

          <Route
            path="support"
            element={<ResidentSupport />}
          />
        </Route>

        {/* 404 */}

        <Route
          path="*"
          element={
            <div className="h-screen flex items-center justify-center text-4xl font-bold">
              404 | Page Not Found
            </div>
          }
        />

      </Routes>
      </Suspense>
    </>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}