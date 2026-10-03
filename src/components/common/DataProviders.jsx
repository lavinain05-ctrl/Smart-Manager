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
import { PropertyProvider } from "../../context/PropertyContext";
import { ActivityProvider } from "../../context/ActivityContext";
import { EmergencyContactProvider } from "../../context/EmergencyContactContext";
import { GarbageProvider } from "../../context/GarbageContext";

// DataProviders provides a stable context tree for the application.
// Individual providers safely guard their Firestore listeners when user is not authenticated or pending.
export default function DataProviders({ children }) {
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
                            <PropertyProvider>
                              <ActivityProvider>
                                <EmergencyContactProvider>
                                  <GarbageProvider>
                                    {children}
                                  </GarbageProvider>
                                </EmergencyContactProvider>
                              </ActivityProvider>
                            </PropertyProvider>
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
