import {
  createContext,
  useContext,
  useState,
  useMemo,
} from "react";

import {
  COLLECTION_START_MONTH,
  COLLECTION_START_YEAR,
  isPriorToCollectionStart,
  getActiveCollectionPeriod,
} from "../utils/billingCycle";

const BillingContext = createContext();

export function BillingProvider({ children }) {
  const activePeriod = useMemo(() => getActiveCollectionPeriod(), []);

  const [selectedMonth, setRawSelectedMonth] = useState(activePeriod.month);
  const [selectedYear, setRawSelectedYear] = useState(activePeriod.year);

  const setSelectedYear = (newYear) => {
    const y = Math.max(COLLECTION_START_YEAR, Number(newYear) || COLLECTION_START_YEAR);
    setRawSelectedYear(y);
    if (isPriorToCollectionStart(selectedMonth, y)) {
      setRawSelectedMonth(COLLECTION_START_MONTH);
    }
  };

  const setSelectedMonth = (newMonth) => {
    if (isPriorToCollectionStart(newMonth, selectedYear)) {
      setRawSelectedMonth(COLLECTION_START_MONTH);
    } else {
      setRawSelectedMonth(newMonth);
    }
  };

  return (
    <BillingContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        activeCollectionPeriod: activePeriod,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  return useContext(BillingContext);
}