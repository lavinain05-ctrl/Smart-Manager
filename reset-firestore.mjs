/**
 * TEMPORARY DATA RESET SCRIPT
 * Run: node reset-firestore.mjs
 * Deletes all Firestore data except admin user doc, blocks, and settings.
 * Delete this file after use.
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { createInterface } from "readline";

const firebaseConfig = {
  apiKey: "AIzaSyBsd-CRBwpdCzR3HpmyUvIOYQcHErPpM48",
  authDomain: "smart-manager-aad4d.firebaseapp.com",
  projectId: "smart-manager-aad4d",
  storageBucket: "smart-manager-aad4d.firebasestorage.app",
  messagingSenderId: "90336703414",
  appId: "1:90336703414:web:e5f7d3a25c7fc7026e0717",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Collections to wipe completely
const WIPE_COLLECTIONS = [
  "residents",
  "bills",
  "payments",
  "paymentAudit",
  "garbageAccounts",
  "garbageBills",
  "garbageCollections",
  "garbageCollectors",
  "garbageRoutes",
  "garbageRequests",
  "garbageCollectionLogs",
  "garbageReports",
  "registrationRequests",
  "notifications",
  "notices",
  "complaints",
  "events",
  "activities",
  "activityLogs",
  "emergencyContacts",
  "deletedAccounts",
  "flats",
  "committee",
  "collectors",
  "profileUpdateRequests",
];

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function deleteCollection(collName, adminUid) {
  const ref = collection(db, collName);
  const snapshot = await getDocs(ref);

  if (snapshot.empty) {
    console.log(`  ${collName}: 0 docs (empty)`);
    return 0;
  }

  let deleted = 0;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + 400);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`  ${collName}: ${deleted} docs deleted ✅`);
  return deleted;
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   SMART MANAGER — FIRESTORE DATA RESET   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  console.log("This will DELETE all data except:");
  console.log("  ✅ Your admin account");
  console.log("  ✅ Blocks master data");
  console.log("  ✅ Settings & garbage settings");
  console.log("");

  const email = await ask("Admin email: ");
  const password = await ask("Admin password: ");

  console.log("");
  console.log("🔐 Signing in...");

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("❌ Login failed:", err.message);
    process.exit(1);
  }

  const adminUid = credential.user.uid;
  console.log(`✅ Signed in as UID: ${adminUid}`);

  // Verify admin role
  const userDoc = await getDoc(doc(db, "users", adminUid));
  if (!userDoc.exists() || userDoc.data().role !== "admin") {
    console.error("❌ This account is not an admin. Aborting.");
    process.exit(1);
  }

  console.log(`✅ Admin role confirmed: ${userDoc.data().name || email}`);
  console.log("");

  const confirm = await ask("Type RESET to confirm deletion: ");
  if (confirm !== "RESET") {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("");
  console.log("🚀 Starting data reset...");
  console.log("");

  let totalDeleted = 0;

  // 1. Wipe all collections
  console.log("── Wiping collections ──");
  for (const collName of WIPE_COLLECTIONS) {
    try {
      const count = await deleteCollection(collName, adminUid);
      totalDeleted += count;
    } catch (err) {
      console.log(`  ❌ ${collName}: ${err.message}`);
    }
  }

  console.log("");

  // 2. Clean users collection (keep admin)
  console.log("── Cleaning users collection ──");
  try {
    const ref = collection(db, "users");
    const snapshot = await getDocs(ref);
    let deleted = 0;
    let kept = 0;

    for (const d of snapshot.docs) {
      if (d.id === adminUid) {
        kept++;
        continue;
      }
      await deleteDoc(doc(db, "users", d.id));
      deleted++;
    }

    totalDeleted += deleted;
    console.log(`  users: ${deleted} deleted, ${kept} kept (your admin account) ✅`);
  } catch (err) {
    console.log(`  ❌ users: ${err.message}`);
  }

  console.log("");
  console.log(`🎉 Reset complete! ${totalDeleted} total documents deleted.`);
  console.log("");
  console.log("✅ Preserved: Your admin account, blocks, settings, garbageSettings");
  console.log("ℹ️  You can now start entering fresh data.");
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
