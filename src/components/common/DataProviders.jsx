import { useAuth } from "../../context/AuthContext";

import { BillingProvider } from "../../context/BillingContext";
import { ResidentProvider } from "../../context/ResidentContext";
import { CollectorProvider } from "../../context/CollectorContext";
import { PaymentProvider } from "../../context/PaymentContext";
import { BillProvider } from "../../context/BillContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { NoticeProvider } from "../../context/NoticeContext";
import { ComplaintProvider } from "../../context/ComplaintContext";
import { EventProvider } from "../../context/EventContext";
import { CommitteeProvider } from "../../context/CommitteeContext";
import { NotificationProvider } from "../../context/NotificationContext";
import { BlockFlatProvider } from "../../context/BlockFlatContext";
import { ActivityProvider } from "../../context/ActivityContext";
import { EmergencyContactProvider } from "../../context/EmergencyContactContext";
import { GarbageProvider } from "../../context/GarbageContext";

// Only mounts data providers when user has an approved role.
// Prevents Firestore permission errors for pending/rejected users.
export default function DataProviders({ children }) {
  const { user, isImpersonating, realUser } = useAuth();

  const currentUser = realUser || user;
  const isApproved = isImpersonating || (currentUser &&
    currentUser.role !== "pending_registration" &&
    currentUser.status !== "pending" &&
    currentUser.status !== "rejected");

  if (!isApproved) {
    return children;
  }

  return (
    <BillingProvider>
      <ResidentProvider>
        <BillProvider>
          <CollectorProvider>
            <PaymentProvider>
              <SettingsProvider>
                <CommitteeProvider>
                  <NoticeProvider>
                    <ComplaintProvider>
                      <EventProvider>
                        <NotificationProvider>
                          <BlockFlatProvider>
                            <ActivityProvider>
                              <EmergencyContactProvider>
                                <GarbageProvider>
                                  {children}
                                </GarbageProvider>
                              </EmergencyContactProvider>
                            </ActivityProvider>
                          </BlockFlatProvider>
                        </NotificationProvider>
                      </EventProvider>
                    </ComplaintProvider>
                  </NoticeProvider>
                </CommitteeProvider>
              </SettingsProvider>
            </PaymentProvider>
          </CollectorProvider>
        </BillProvider>
      </ResidentProvider>
    </BillingProvider>
  );
}
