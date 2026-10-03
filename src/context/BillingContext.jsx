import {
  createContext,
  useContext,
  useState,
} from "react";

import {
  COLLECTION_START_MONTH,
  COLLECTION_START_YEAR,
  isPriorToCollectionStart,
} from "../utils/billingCycle";

const BillingContext = createContext();

export function BillingProvider({ children }) {
  const now = new Date();
  const rawMonth = now.toLocaleString("default", { month: "long" });
  const rawYear = now.getFullYear();

  const initialYear = rawYear < COLLECTION_START_YEAR ? COLLECTION_START_YEAR : rawYear;
  const initialMonth = isPriorToCollectionStart(rawMonth, initialYear)
    ? COLLECTION_START_MONTH
    : rawMonth;

  const [selectedMonth, setRawSelectedMonth] = useState(initialMonth);
  const [selectedYear, setRawSelectedYear] = useState(initialYear);

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
      }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  return useContext(BillingContext);
}