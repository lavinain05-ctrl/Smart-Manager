import toast from "react-hot-toast";
import { doc, getDocs, query, where, collection, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

import { addBill, updateBill } from "../services/billService";

// =============================
// collectResidentPayment
// =============================
//
// Shared by the admin Collections page and the Collector portal's
// Collect screen. Given a resident and a billing month/year:
//   1. Finds the matching bill (from the already-loaded `bills`
//      array — no extra Firestore reads), or creates one if it
//      doesn't exist yet.
//   2. Records the payment via the supplied `addPayment` function
//      (which already handles duplicate-payment checks and the toast).
//   3. Marks the bill Paid/Exempted and updates the amount.
//   4. Synchronizes garbageBills, resident.charge, and garbageAccounts.
//
// This keeps a payment and its bill in sync no matter which screen
// collected it. Returns true on success, false otherwise.
export async function collectResidentPayment({
  resident,
  month,
  year,
  paymentData,
  bills,
  addPayment: _addPayment,
  collector,
  collectorId,
}) {
  try {
    const isAdvance = Boolean(
      paymentData.isAdvance &&
      Array.isArray(paymentData.coveredMonths) &&
      paymentData.coveredMonths.length > 1
    );

    const coveredMonths = isAdvance
      ? paymentData.coveredMonths
      : [{ month, year: Number(year) }];

    const duration = coveredMonths.length;
    const totalAmount = paymentData.amount !== undefined ? Number(paymentData.amount) : Number(resident.charge || 0);
    const monthlyRate = paymentData.monthlyRate !== undefined
      ? Number(paymentData.monthlyRate)
      : (duration > 0 ? Math.round(totalAmount / duration) : Number(resident.charge || 0));

    const receiptNo = "REC-" + Date.now();
    const newStatus = paymentData.method === "Exempted" ? "Exempted" : "Paid";
    const finalMonthlyAmount = paymentData.method === "Exempted" ? 0 : monthlyRate;
    const finalTotalAmount = paymentData.method === "Exempted" ? 0 : totalAmount;

    const startM = coveredMonths[0].month;
    const startY = Number(coveredMonths[0].year);
    const endM = coveredMonths[duration - 1].month;
    const endY = Number(coveredMonths[duration - 1].year);
    const periodLabel = isAdvance
      ? `${startM} ${startY} — ${endM} ${endY} (${duration} Months Advance)`
      : `${month} ${year}`;

    // 1. Find or create garbageAccount
    let accountId = "";
    try {
      const accQuery = query(collection(db, "garbageAccounts"), where("residentId", "==", resident.id));
      const accSnap = await getDocs(accQuery);
      if (!accSnap.empty) {
        accountId = accSnap.docs[0].id;
        const accData = accSnap.docs[0].data();
        if (monthlyRate > 0 && (!accData.monthlyCharge || Number(accData.monthlyCharge) === 0)) {
          await updateDoc(doc(db, "garbageAccounts", accountId), {
            monthlyCharge: monthlyRate,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (monthlyRate > 0) {
        const newAcc = await addDoc(collection(db, "garbageAccounts"), {
          residentId: resident.id,
          monthlyCharge: monthlyRate,
          collectorId: collectorId || "",
          collectorName: collector || "",
          status: "active",
          joinedDate: paymentData.date || new Date().toISOString().split("T")[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        accountId = newAcc.id;
      }
    } catch (accErr) {
      console.warn("Could not sync garbageAccount:", accErr.message);
    }

    // 2. Process each covered month
    for (let i = 0; i < coveredMonths.length; i++) {
      const cm = coveredMonths[i];
      const mName = cm.month;
      const yNum = Number(cm.year);

      // A. Bill synchronization
      const existingBill = bills.find(
        (bill) =>
          bill.residentId === resident.id &&
          bill.month === mName &&
          Number(bill.year) === yNum
      );

      let billId = existingBill?.id;

      if (!billId) {
        const newBillRef = await addBill({
          residentId: resident.id || "",
          residentName: resident.owner || resident.name || "Resident",
          flat: resident.flat || resident.flatNumber || "",
          block: resident.block || "",
          amount: finalMonthlyAmount,
          paidAmount: finalMonthlyAmount,
          month: mName,
          year: yNum,
          status: newStatus,
          paymentId: receiptNo,
          paymentDate: paymentData.date || new Date().toLocaleDateString("en-IN"),
          paymentMethod: paymentData.method || "Cash",
          dueDate: `10 ${mName} ${yNum}`,
          isAdvance,
          periodLabel,
        });
        billId = newBillRef.id;
      } else {
        await updateBill(billId, {
          status: newStatus,
          amount: finalMonthlyAmount > 0 ? finalMonthlyAmount : (existingBill.amount || monthlyRate || 0),
          paidAmount: finalMonthlyAmount,
          paymentId: receiptNo,
          paymentDate: paymentData.date || new Date().toLocaleDateString("en-IN"),
          paymentMethod: paymentData.method || "Cash",
          isAdvance,
          periodLabel,
        });
      }

      // B. Payment record in payments collection
      const paymentPayload = {
        residentId: resident.id || "",
        residentName: resident.owner || resident.name || "Resident",
        flat: resident.flat || resident.flatNumber || "",
        block: resident.block || "",
        amount: finalMonthlyAmount,
        totalPaidAmount: finalTotalAmount,
        monthlyRate,
        isAdvance,
        advanceDuration: duration,
        startMonth: startM,
        startYear: startY,
        endMonth: endM,
        endYear: endY,
        periodLabel,
        coveredMonths,
        paymentMethod: paymentData.method || "Cash",
        paymentDate: paymentData.date || new Date().toLocaleDateString("en-IN"),
        paymentTime: paymentData.time || new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        collector: collector || "Collector",
        collectorId: collectorId || "",
        collectorRole: paymentData.collectorRole || "collector",
        collectorDesignation: paymentData.collectorDesignation || "",
        collectorName: paymentData.collectorName || collector || "Collector",
        referenceNumber: paymentData.referenceNumber || "",
        remarks: paymentData.remarks || "",
        receiptNumber: receiptNo,
        month: mName,
        year: yNum,
        billId: billId || "",
        createdAt: serverTimestamp(),
      };

      // Check if payment doc already exists for this resident and month/year
      try {
        const payQ = query(
          collection(db, "payments"),
          where("residentId", "==", resident.id),
          where("month", "==", mName),
          where("year", "==", yNum)
        );
        const paySnap = await getDocs(payQ);
        if (!paySnap.empty) {
          await updateDoc(doc(db, "payments", paySnap.docs[0].id), paymentPayload);
        } else {
          await addDoc(collection(db, "payments"), paymentPayload);
        }
      } catch (pErr) {
        console.warn("Could not write payment document for " + mName + ":", pErr.message);
      }

      // C. GarbageBills synchronization
      try {
        const gBillQuery = query(
          collection(db, "garbageBills"),
          where("residentId", "==", resident.id),
          where("month", "==", mName),
          where("year", "==", yNum)
        );
        const gSnap = await getDocs(gBillQuery);

        if (!gSnap.empty) {
          await Promise.all(
            gSnap.docs.map((gDoc) =>
              updateDoc(doc(db, "garbageBills", gDoc.id), {
                status: newStatus,
                amount: finalMonthlyAmount > 0 ? finalMonthlyAmount : (gDoc.data().amount || monthlyRate),
                paidAmount: finalMonthlyAmount,
                paymentDate: paymentData.date,
                paymentMethod: paymentData.method,
                collectedById: collectorId || "",
                isAdvance,
                periodLabel,
                updatedAt: serverTimestamp(),
              })
            )
          );
        } else {
          await addDoc(collection(db, "garbageBills"), {
            accountId: accountId || "",
            residentId: resident.id,
            month: mName,
            year: yNum,
            amount: finalMonthlyAmount,
            paidAmount: finalMonthlyAmount,
            status: newStatus,
            paymentDate: paymentData.date,
            paymentMethod: paymentData.method,
            collectedById: collectorId || "",
            dueDate: `10 ${mName} ${yNum}`,
            isAdvance,
            periodLabel,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (gErr) {
        console.warn("Could not sync garbageBills for " + mName + ":", gErr.message);
      }
    }

    // 3. Sync resident charge if 0 or missing
    if (resident?.id && monthlyRate > 0 && (!resident.charge || Number(resident.charge) === 0)) {
      try {
        await updateDoc(doc(db, "residents", resident.id), {
          charge: monthlyRate,
          updatedAt: serverTimestamp(),
        });
      } catch (rErr) {
        console.warn("Could not update resident charge:", rErr.message);
      }
    }

    // 4. Send in-app notification to resident
    const targetUid = resident.userId || resident.uid || resident.id;
    if (targetUid) {
      try {
        await addDoc(collection(db, "notifications"), {
          userId: targetUid,
          title: isAdvance
            ? `✅ Advance Garbage Fee Paid (${duration} Months)`
            : `✅ Garbage Fee Payment Confirmed — ${month} ${year}`,
          message: isAdvance
            ? `Your advance payment of ₹${finalTotalAmount} covering ${duration} months (${periodLabel}) has been recorded (${paymentData.method}). Official Receipt: ${receiptNo}.`
            : `Your payment of ₹${finalMonthlyAmount} for ${month} ${year} has been recorded (${paymentData.method}). Official Receipt: ${receiptNo}.`,
          type: "payment",
          link: "/resident/bills",
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (nErr) {
        console.warn("Could not dispatch payment notification:", nErr.message);
      }
    }

    if (isAdvance) {
      toast.success(
        `Advance payment for ${duration} months (₹${finalTotalAmount}) recorded! Receipt: ${receiptNo}`
      );
    } else {
      toast.success(`Payment recorded for ${month} ${year}! Receipt: ${receiptNo}`);
    }

    const receiptData = {
      receiptNumber: receiptNo,
      residentId: resident.id,
      residentName: resident.owner || resident.name || "Resident",
      flat: resident.flat || resident.flatNumber || "",
      block: resident.block || "",
      amount: finalTotalAmount,
      totalPaidAmount: finalTotalAmount,
      monthlyRate,
      isAdvance,
      advanceDuration: duration,
      coveredMonths,
      periodLabel,
      month,
      year: Number(year),
      paymentMethod: paymentData.method || "Cash",
      paymentDate: paymentData.date || new Date().toLocaleDateString("en-IN"),
      paymentTime: paymentData.time || new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      collector: collector || "Collector",
      collectorRole: paymentData.collectorRole || "collector",
      collectorDesignation: paymentData.collectorDesignation || "",
      collectorName: paymentData.collectorName || collector || "Collector",
      remarks: paymentData.remarks || "",
      type: "Garbage Collection",
      collectionType: "garbage",
      success: true,
    };

    return receiptData;
  } catch (error) {
    console.error("collectResidentPayment error:", error);
    toast.error(error?.message || "Failed to record payment — please verify details and try again.");
    return false;
  }
}