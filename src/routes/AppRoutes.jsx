import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import PendingApproval from "../pages/auth/PendingApproval";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ForceChangePassword from "../pages/auth/ForceChangePassword";

import PublicNotice from "../pages/public/PublicNotice";
import PublicEvent from "../pages/public/PublicEvent";
import PublicSpecialCollection from "../pages/public/PublicSpecialCollection";

import MainLayout from "../components/layout/MainLayout";

import Dashboard from "../pages/admin/Dashboard";
import Residents from "../pages/admin/Residents";
import SpecialCollections from "../pages/admin/SpecialCollections";
import Collections from "../pages/admin/Collections";
import Collectors from "../pages/admin/Collectors";
import Settings from "../pages/admin/Settings";
import PaymentHistory from "../pages/admin/PaymentHistory";
import Receipts from "../pages/admin/Receipts";
import Bills from "../pages/admin/Bills";
import CollectorDailyReport from "../pages/admin/CollectorDailyReport";
import Notices from "../pages/admin/Notices";
import Complaints from "../pages/admin/Complaints";
import Events from "../pages/admin/Events";
import PendingRegistrations from "../pages/admin/PendingRegistrations";
import ManageFamilyMembers from "../pages/admin/ManageFamilyMembers";
import ManageCommittee from "../pages/admin/ManageCommittee";
import ProfileRequests from "../pages/admin/ProfileRequests";
import BlocksAndFlats from "../pages/admin/BlocksAndFlats";
import Activities from "../pages/admin/Activities";
import ActivityLogs from "../pages/admin/ActivityLogs";
import EmergencyContacts from "../pages/admin/EmergencyContacts";
import RegistrationRequests from "../pages/admin/RegistrationRequests";
import DeletedAccounts from "../pages/admin/DeletedAccounts";
import BlockedAccounts from "../pages/admin/BlockedAccounts";
import ResetData from "../pages/admin/ResetData";
import AccountRecovery from "../pages/admin/AccountRecovery";
import ManageSupport from "../pages/admin/ManageSupport";

import GarbageDashboard from "../pages/admin/GarbageDashboard";
import GarbageAccounts from "../pages/admin/GarbageAccounts";
import GarbageCollectors from "../pages/admin/GarbageCollectors";
import GarbageReports from "../pages/admin/GarbageReports";
import GarbageRequests from "../pages/admin/GarbageRequests";
import GarbageSettings from "../pages/admin/GarbageSettings";

import CollectorLayout from "../components/layout/CollectorLayout";
import CollectorDashboard from "../pages/collector/CollectorDashboard";
import CollectorCollect from "../pages/collector/CollectorCollect";
import CollectorHistory from "../pages/collector/CollectorHistory";

import GarbageCollectorDashboard from "../pages/collector/GarbageCollectorDashboard";
import GarbageCollectorCollect from "../pages/collector/GarbageCollectorCollect";
import GarbageCollectorHistory from "../pages/collector/GarbageCollectorHistory";

import ResidentLayout from "../components/layout/ResidentLayout";
import ResidentDashboard from "../pages/resident/ResidentDashboard";
import ResidentBills from "../pages/resident/ResidentBills";
import ResidentPayments from "../pages/resident/ResidentPayments";
import ResidentReceipts from "../pages/resident/ResidentReceipts";
import ResidentNotices from "../pages/resident/ResidentNotices";
import ResidentProfile from "../pages/resident/ResidentProfile";
import ResidentComplaints from "../pages/resident/ResidentComplaints";
import ResidentEvents from "../pages/resident/ResidentEvents";
import ResidentActivities from "../pages/resident/ResidentActivities";
import ResidentEmergency from "../pages/resident/ResidentEmergency";
import ResidentGarbage from "../pages/resident/ResidentGarbage";
import ResidentCommittee from "../pages/resident/ResidentCommittee";
import ResidentSpecialCollections from "../pages/resident/ResidentSpecialCollections";
import ResidentSupport from "../pages/resident/ResidentSupport";

import ProtectedRoute from "../pages/auth/ProtectedRoute";
import AdminRoute from "../pages/auth/AdminRoute";
import CollectorRoute from "../pages/auth/CollectorRoute";
import ResidentRoute from "../pages/auth/ResidentRoute";
import FamilyRoute from "../pages/auth/FamilyRoute";

import FamilyLayout from "../components/layout/FamilyLayout";
import FamilyDashboard from "../pages/family/FamilyDashboard";

import CommitteeRoute from "../pages/auth/CommitteeRoute";
import CommitteeLayout from "../components/layout/CommitteeLayout";
import CommitteeDashboard from "../pages/committee/CommitteeDashboard";
import CommitteeGarbage from "../pages/committee/CommitteeGarbage";
import CommitteeCollect from "../pages/committee/CommitteeCollect";
import CommitteeCollectionHistory from "../pages/committee/CommitteeCollectionHistory";
import ImpersonationBanner from "../components/common/ImpersonationBanner";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <ImpersonationBanner />
      <Routes>

        {/* Login */}

        <Route
          path="/"
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
            <ProtectedRoute>
              <AdminRoute>
                <MainLayout />
              </AdminRoute>
            </ProtectedRoute>
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
            element={<GarbageAccounts />}
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
            <ProtectedRoute>
              <CollectorRoute>
                <CollectorLayout />
              </CollectorRoute>
            </ProtectedRoute>
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
        </Route>

        {/* Resident Routes */}

        <Route
          path="/resident"
          element={
            <ProtectedRoute>
              <ResidentRoute>
                <ResidentLayout />
              </ResidentRoute>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <FamilyRoute>
                <FamilyLayout />
              </FamilyRoute>
            </ProtectedRoute>
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
            <ProtectedRoute>
              <CommitteeRoute>
                <CommitteeLayout />
              </CommitteeRoute>
            </ProtectedRoute>
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
            element={<CommitteeDashboard />}
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
            element={<CommitteeCollect />}
          />
          <Route
            path="history"
            element={<CommitteeCollectionHistory />}
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
    </BrowserRouter>
  );
}