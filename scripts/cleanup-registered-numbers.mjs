/**
 * CLI Tool: Audit and clean up orphaned registered numbers and Firebase Auth accounts
 *
 * Usage:
 *   node scripts/cleanup-registered-numbers.mjs --dry-run
 *   node scripts/cleanup-registered-numbers.mjs --delete
 */

import fs from "fs";
import path from "path";
import { getAdminApp } from "./delete-auth-user.mjs";

const PROTECTED_ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";
const PROTECTED_ADMIN_EMAIL = "dharmendrasngh101@gmail.com";
const AUTH_EMAIL_DOMAIN = "smart-manager-aad4d.firebaseapp.com";

async function main() {
  const isDelete = process.argv.includes("--delete");
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     FIREBASE AUTH REGISTERED NUMBERS CLEANUP AUDIT         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Mode: ${isDelete ? "🚨 DELETE (LIVE ACTION)" : "🔍 DRY RUN (Audit Only)"}`);
  console.log("");

  const app = await getAdminApp();
  const auth = app.auth();

  console.log("📡 Fetching all Firebase Auth accounts...");
  const userList = await auth.listUsers(1000);
  console.log(`Found ${userList.users.length} total user accounts in Firebase Authentication.\n`);

  let deletedCount = 0;

  for (const user of userList.users) {
    if (user.uid === PROTECTED_ADMIN_UID || user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()) {
      console.log(`🛡️  Admin Account [PROTECTED]: ${user.email} (UID: ${user.uid})`);
      continue;
    }

    const email = user.email || "";
    const isPseudo = email.endsWith(`@${AUTH_EMAIL_DOMAIN}`);
    const mobile = isPseudo ? email.split("@")[0] : "";

    console.log(`• Auth User: ${user.email} | Phone: ${user.phoneNumber || mobile || "N/A"} | UID: ${user.uid}`);

    if (isDelete) {
      try {
        await auth.deleteUser(user.uid);
        console.log(`  ✅ DELETED from Firebase Authentication: ${user.email}`);
        deletedCount++;
      } catch (err) {
        console.error(`  ❌ Failed to delete ${user.uid}:`, err.message);
      }
    }
  }

  console.log("\n════════════════════════════════════════════════════════════");
  if (isDelete) {
    console.log(`🎉 Cleanup completed. ${deletedCount} account(s) deleted from Firebase Auth.`);
  } else {
    console.log("ℹ️  To delete orphaned accounts from Firebase Auth, re-run with:");
    console.log("   node scripts/cleanup-registered-numbers.mjs --delete");
    console.log("Or to delete a single mobile number:");
    console.log("   node scripts/delete-auth-user.mjs <phone_or_email>");
  }
  console.log("════════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
