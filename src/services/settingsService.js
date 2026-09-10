import { doc, setDoc, onSnapshot } from "firebase/firestore";

import { db } from "../firebase/firebase";

// A single shared document rather than a collection — there's only
// ever one society's settings.
const settingsRef = doc(db, "settings", "society");

const defaultSettings = {
  // General
  societyName: "",
  address: "",
  monthlyCharge: 0,
  collectorTiming: "",
  contactNumber: "",
  // Office
  officeTiming: "",
  supportEmail: "",
  supportPhone: "",
  // Bank
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  bankBranch: "",
  upiId: "",
  // Society
  societyRules: "",
  codeOfConduct: "",
  googleMapUrl: "",
};

export function subscribeSettings(callback) {
  return onSnapshot(settingsRef, (snapshot) => {
    callback(
      snapshot.exists() ? snapshot.data() : defaultSettings
    );
  }, (error) => {
    console.error("[Firestore] settings listener error:", error.message);
  });
}

export async function saveSettings(settings) {
  return await setDoc(settingsRef, settings, {
    merge: true,
  });
}