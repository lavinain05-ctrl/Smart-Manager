import {
  createContext,
  useContext,
  useState,
} from "react";

const BillingContext = createContext();

export function BillingProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("default", {
      month: "long",
    })
  );

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );

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