const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDueDate(dueDate) {
  if (!dueDate) return null;

  const parts = dueDate.split(" ");

  if (parts.length !== 3) return null;

  const [day, monthName, year] = parts;
  const monthIndex = MONTHS.indexOf(monthName);

  if (monthIndex === -1) return null;

  return new Date(Number(year), monthIndex, Number(day));
}

export function getDisplayStatus(bill) {
  if (!bill || bill.status !== "Pending") {
    return bill?.status || "Pending";
  }

  const due = parseDueDate(bill.dueDate);

  if (due && due < new Date()) {
    return "Overdue";
  }

  return "Pending";
}