const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseDueDate(dueDate, month, year) {
  if (dueDate && typeof dueDate === "string") {
    const parts = dueDate.trim().split(" ");
    if (parts.length === 3) {
      const [day, monthName, yStr] = parts;
      const monthIndex = MONTHS.indexOf(monthName);
      const dNum = Number(day);
      const yNum = Number(yStr);
      if (monthIndex !== -1 && !isNaN(dNum) && !isNaN(yNum) && dNum > 0 && yNum > 0) {
        // Due date is valid through the end of that day (23:59:59.999)
        return new Date(yNum, monthIndex, dNum, 23, 59, 59, 999);
      }
    }
    // Attempt standard Date parsing if formatted differently
    const parsed = new Date(dueDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      return parsed;
    }
  }

  // Fallback: If no explicit valid dueDate string, compute last date of the month
  if (month && year) {
    const monthIndex = typeof month === "number" ? month : MONTHS.indexOf(month);
    const yNum = Number(year);
    if (monthIndex !== -1 && yNum) {
      const lastDay = new Date(yNum, monthIndex + 1, 0).getDate();
      return new Date(yNum, monthIndex, lastDay, 23, 59, 59, 999);
    }
  }

  return null;
}

export function getDisplayStatus(bill) {
  if (!bill || bill.status !== "Pending") {
    return bill?.status || "Pending";
  }

  const due = parseDueDate(bill.dueDate, bill.month, bill.year);

  if (due && due < new Date()) {
    return "Overdue";
  }

  return "Pending";
}