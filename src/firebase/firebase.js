import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBsd-CRBwpdCzR3HpmyUvIOYQcHErPpM48",
  authDomain: "smart-manager-aad4d.firebaseapp.com",
  projectId: "smart-manager-aad4d",
  storageBucket: "smart-manager-aad4d.firebasestorage.app",
  messagingSenderId: "90336703414",
  appId: "1:90336703414:web:e5f7d3a25c7fc7026e0717",
  measurementId: "G-F786LSDS93",
};

const app = initializeApp(firebaseConfig);

// Secondary app instance, used ONLY when an admin creates a new
// login (e.g. a collector account). Firebase's client SDK signs in
// as whichever user it just created on a given auth instance — if
// we used the primary `auth` instance for that, adding a collector
// would silently log the admin out and log them in as the new
// collector. Creating on a separate named app avoids that entirely.
const secondaryApp = getApps().some((existing) => existing.name === "Secondary")
  ? getApp("Secondary")
  : initializeApp(firebaseConfig, "Secondary");

export const db = getFirestore(app);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// =============================
// Cloud Function Callables
// =============================

export const deleteAuthAccountFn = httpsCallable(functions, "deleteAuthAccount");
export const checkRegistrationAvailabilityFn = httpsCallable(functions, "checkRegistrationAvailability");
export const migrateAdminToMobileFn = httpsCallable(functions, "migrateAdminToMobile");
export const adminResetPasswordFn = httpsCallable(functions, "adminResetPassword");

export default app;