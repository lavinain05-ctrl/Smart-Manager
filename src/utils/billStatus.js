const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseDueDate(dueDate, month, year) {
  let mIndex = -1;
  let yNum = Number(year);

  if (month) {
    mIndex = typeof month === "number" ? month : MONTHS.indexOf(month);
  }

  // If dueDate string is given and month/year was not resolved, parse from dueDate
  if ((mIndex === -1 || !yNum) && dueDate && typeof dueDate === "string") {
    const parts = dueDate.trim().split(" ");
    if (parts.length === 3) {
      mIndex = MONTHS.indexOf(parts[1]);
      yNum = Number(parts[2]);
    }
  }

  // Due date is strictly the 30th of the billing month (never after 30th; 28/29 for Feb)
  if (mIndex !== -1 && yNum) {
    const maxDays = new Date(yNum, mIndex + 1, 0).getDate();
    const dueDay = Math.min(30, maxDays);
    return new Date(yNum, mIndex, dueDay, 23, 59, 59, 999);
  }

  // Fallback: If formatted differently, attempt Date parsing
  if (dueDate) {
    const parsed = new Date(dueDate);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      return parsed;
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