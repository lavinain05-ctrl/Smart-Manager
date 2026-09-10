import { useMemo } from "react";
import {
  FaUsers,
  FaBuilding,
  FaUserTie,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaReceipt,
  FaRecycle,
  FaExclamationCircle,
  FaCalendarAlt,
  FaUserPlus,
} from "react-icons/fa";

import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useCollectors } from "../../context/CollectorContext";
import { useCommittee } from "../../context/CommitteeContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useComplaints } from "../../context/ComplaintContext";
import { useGarbage } from "../../context/GarbageContext";
import { useEvents } from "../../context/EventContext";
import { useNotices } from "../../context/NoticeContext";

import {
  calcResidentStats,
  calcPaymentStats,
  calcGarbageStats,
  calcComplaintStats,
  calcEventStats,
  calcNoticeStats,
  calcBlockStats,
  calcCommitteeStats,
  calcCollectorStats,
  getGarbageMonthlyStats,
} from "../../services/statisticsService";

import CollectionProgress from "../../components/dashboard/CollectionProgress";
import RecentActivity from "../../components/dashboard/RecentActivity";
import QuickActions from "../../components/dashboard/QuickActions";
import MonthSelector from "../../components/common/MonthSelector";
import SummaryCard from "../../components/dashboard/SummaryCard";

export default function Dashboard() {
  const { residents } = useResidents();
  const { payments } = usePayments();
  const { selectedMonth, selectedYear } = useBilling();
  const { collectors } = useCollectors();
  const { committee } = useCommittee();
  const { blocks, flats } = useBlockFlat();
  const { complaints } = useComplaints();
  const { garbageAccounts, garbageBills } = useGarbage();
  const { events } = useEvents();
  const { notices } = useNotices();

  // ─── Statistics from shared engine ───
  const residentStats = useMemo(() => calcResidentStats(residents), [residents]);
  const paymentStats = useMemo(() => calcPaymentStats(payments, residents, selectedMonth, selectedYear), [payments, residents, selectedMonth, selectedYear]);
  const garbageStats = useMemo(() => calcGarbageStats(garbageAccounts, garbageBills, residents, selectedMonth, selectedYear, payments), [garbageAccounts, garbageBills, residents, selectedMonth, selectedYear, payments]);
  const complaintStats = useMemo(() => calcComplaintStats(complaints), [complaints]);
  const eventStats = useMemo(() => calcEventStats(events), [events]);
  const noticeStats = useMemo(() => calcNoticeStats(notices), [notices]);
  const blockStats = useMemo(() => calcBlockStats(blocks, flats, residents), [blocks, flats, residents]);
  const committeeStats = useMemo(() => calcCommitteeStats(committee), [committee]);
  const collectorStats = useMemo(() => calcCollectorStats(collectors), [collectors]);
  const gcMonthlyStats = useMemo(() => getGarbageMonthlyStats(residents, garbageBills, selectedMonth, selectedYear, payments), [residents, garbageBills, selectedMonth, selectedYear, payments]);

  return (
    <div className="space-y-8">

      {/* Billing Period Selector */}
      <MonthSelector />

      {/* ═══════════ Row 1: Society Overview ═══════════ */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">D BLOCK RWA INDRAPRASTHA — Society Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <SummaryCard
            title="Total Residents"
            value={residentStats.total}
            subtitle={`${residentStats.active} Active • ${residentStats.inactive} Inactive`}
            color="bg-gradient-to-r from-blue-600 to-blue-500"
            icon={<FaUsers />}
          />
          <SummaryCard
            title="Society Blocks"
            value={blockStats.totalBlocks}
            subtitle={`${blockStats.totalBlocks === 1 ? "1 Block" : `${blockStats.totalBlocks} Blocks`} Active`}
            color="bg-gradient-to-r from-indigo-600 to-indigo-500"
            icon={<FaBuilding />}
          />
          <SummaryCard
            title="Committee"
            value={committeeStats.total}
            subtitle={`${committeeStats.active} Active Members`}
            color="bg-gradient-to-r from-purple-600 to-purple-500"
            icon={<FaUserTie />}
          />
          <SummaryCard
            title="Collectors"
            value={collectorStats.total}
            subtitle={`${collectorStats.active} Active`}
            color="bg-gradient-to-r from-teal-600 to-teal-500"
            icon={<FaUserTie />}
          />
          <SummaryCard
            title="GC Participants"
            value={garbageStats.gcParticipants}
            subtitle={`${garbageStats.activeAccounts} Active Accounts`}
            color="bg-gradient-to-r from-emerald-600 to-green-500"
            icon={<FaRecycle />}
          />
        </div>
      </div>

      {/* ═══════════ Row 2: Financial Overview ═══════════ */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Maintenance Collection — {selectedMonth} {selectedYear}</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            title="Collected"
            value={`₹${paymentStats.collectedAmount.toLocaleString()}`}
            subtitle={`${paymentStats.collectionRate}% of Expected`}
            color="bg-gradient-to-r from-emerald-600 to-green-500"
            icon={<FaMoneyBillWave />}
          />
          <SummaryCard
            title="Pending"
            value={`₹${paymentStats.pendingAmount.toLocaleString()}`}
            subtitle={`${paymentStats.pendingCount} Residents`}
            color="bg-gradient-to-r from-red-600 to-orange-500"
            icon={<FaClock />}
          />
          <SummaryCard
            title="Paid Residents"
            value={paymentStats.paidCount}
            subtitle={`of ${residentStats.active} Active`}
            color="bg-gradient-to-r from-green-600 to-emerald-500"
            icon={<FaCheckCircle />}
          />
          <SummaryCard
            title="Today's Collection"
            value={`₹${paymentStats.todayTotal.toLocaleString()}`}
            subtitle={`${paymentStats.todayCount} Payments`}
            color="bg-gradient-to-r from-amber-600 to-yellow-500"
            icon={<FaWallet />}
          />
        </div>
      </div>

      {/* ═══════════ Row 3: Today's Breakdown ═══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center gap-3 text-green-600 mb-2">
            <FaWallet />
            <span className="text-sm font-medium text-gray-500">Cash</span>
          </div>
          <h3 className="text-2xl font-bold">₹{paymentStats.todayCash.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <FaMobileAlt />
            <span className="text-sm font-medium text-gray-500">UPI</span>
          </div>
          <h3 className="text-2xl font-bold">₹{paymentStats.todayUPI.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <FaUniversity />
            <span className="text-sm font-medium text-gray-500">Bank Transfer</span>
          </div>
          <h3 className="text-2xl font-bold">₹{paymentStats.todayBank.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-orange-500">
          <div className="flex items-center gap-3 text-orange-600 mb-2">
            <FaReceipt />
            <span className="text-sm font-medium text-gray-500">Total Receipts</span>
          </div>
          <h3 className="text-2xl font-bold">{paymentStats.totalReceipts}</h3>
        </div>
      </div>

      {/* ═══════════ Collection Progress (GC Billing) ═══════════ */}
      <CollectionProgress
        collected={gcMonthlyStats.collectedAmount}
        target={gcMonthlyStats.expectedAmount}
        paidResidents={gcMonthlyStats.paidResidents}
        totalParticipants={gcMonthlyStats.participants}
      />

      {/* ═══════════ Row 4: Module Summaries ═══════════ */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Module Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Garbage Collection */}
          <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <FaRecycle />
              </div>
              <h3 className="font-bold text-gray-800">Garbage</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Billed</span><span className="font-semibold">₹{gcMonthlyStats.expectedAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Collected</span><span className="font-semibold text-emerald-600">₹{gcMonthlyStats.collectedAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pending</span><span className="font-semibold text-red-600">₹{gcMonthlyStats.pendingAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Rate</span><span className="font-semibold">{gcMonthlyStats.collectionPercentage}%</span></div>
            </div>
          </div>

          {/* Complaints */}
          <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <FaExclamationCircle />
              </div>
              <h3 className="font-bold text-gray-800">Complaints</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">{complaintStats.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Open</span><span className="font-semibold text-red-600">{complaintStats.open}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">In Progress</span><span className="font-semibold text-yellow-600">{complaintStats.inProgress}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Resolved</span><span className="font-semibold text-emerald-600">{complaintStats.resolved}</span></div>
            </div>
          </div>

          {/* Events & Notices */}
          <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <FaCalendarAlt />
              </div>
              <h3 className="font-bold text-gray-800">Events & Notices</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total Events</span><span className="font-semibold">{eventStats.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Upcoming</span><span className="font-semibold text-blue-600">{eventStats.upcoming}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Notices</span><span className="font-semibold">{noticeStats.total}</span></div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <FaUserPlus />
              </div>
              <h3 className="font-bold text-gray-800">Quick Stats</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">GC Accounts</span><span className="font-semibold">{gcMonthlyStats.participants}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GC Paid</span><span className="font-semibold text-emerald-600">{gcMonthlyStats.paidResidents}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GC Pending</span><span className="font-semibold text-red-600">{gcMonthlyStats.pendingResidents}</span></div>
            </div>
          </div>

        </div>
      </div>


      {/* ═══════════ Row 5: Activity + Quick Actions ═══════════ */}
      <div className="grid xl:grid-cols-2 gap-6">
        <RecentActivity payments={paymentStats.monthlyPayments} />
        <QuickActions />
      </div>

    </div>
  );
}