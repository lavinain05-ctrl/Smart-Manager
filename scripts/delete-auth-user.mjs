/**
 * CLI Tool to delete any user from Firebase Authentication
 *
 * Usage:
 *   node scripts/delete-auth-user.mjs <phone_or_email_or_uid>
 * Example:
 *   node scripts/delete-auth-user.mjs 9876543210
 *   node scripts/delete-auth-user.mjs resident@example.com
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");

const PROTECTED_ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";
const PROTECTED_ADMIN_EMAIL = "dharmendrasngh101@gmail.com";
const AUTH_EMAIL_DOMAIN = "smart-manager-aad4d.firebaseapp.com";
const PROJECT_ID = "smart-manager-aad4d";

function getFirebaseToken() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".config",
    "configstore",
    "firebase-tools.json"
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase tools config not found at: ${configPath}. Please run 'firebase login'.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.tokens || !config.tokens.access_token) {
    throw new Error("No access token found in firebase-tools.json. Please run 'firebase login'.");
  }

  return config.tokens.access_token;
}

export async function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  const accessToken = getFirebaseToken();
  return admin.initializeApp(
    {
      credential: {
        getAccessToken: () =>
          Promise.resolve({
            access_token: accessToken,
            expires_in: 3600,
          }),
      },
      projectId: PROJECT_ID,
    },
    "cliApp"
  );
}

function normalizeMobile(mobile) {
  if (!mobile) return "";
  const digits = String(mobile).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export async function deleteAuthUserByIdentifiers({ uid, phone, email, uids = [], phones = [], emails = [] }) {
  const app = await getAdminApp();
  const auth = admin.auth(app);

  const allUids = new Set([uid, ...uids].filter(Boolean));
  const allPhones = new Set([phone, ...phones].map(normalizeMobile).filter((p) => p && p.length === 10));
  const allEmails = new Set([email, ...emails].map((e) => (e || "").trim().toLowerCase()).filter(Boolean));

  for (const p of allPhones) {
    allEmails.add(`${p}@${AUTH_EMAIL_DOMAIN}`);
  }

  // Look up UIDs by email
  for (const em of allEmails) {
    try {
      const u = await auth.getUserByEmail(em);
      if (u) allUids.add(u.uid);
    } catch {
      // not found
    }
  }

  // Look up UIDs by phone number
  for (const p of allPhones) {
    try {
      const u = await auth.getUserByPhoneNumber(`+91${p}`);
      if (u) allUids.add(u.uid);
    } catch {
      // not found
    }
  }

  const deleted = [];

  for (const u of allUids) {
    if (u === PROTECTED_ADMIN_UID) {
      console.warn(`[DeleteAuth] Skipping protected Admin UID: ${u}`);
      continue;
    }

    try {
      const userRecord = await auth.getUser(u);
      if (userRecord.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()) {
        console.warn(`[DeleteAuth] Skipping protected Admin Email: ${userRecord.email}`);
        continue;
      }

      await auth.deleteUser(u);
      console.log(`[DeleteAuth] Deleted user UID=${u} (${userRecord.email || userRecord.phoneNumber || "no-email"})`);
      deleted.push({ uid: u, email: userRecord.email, phone: userRecord.phoneNumber });
    } catch (err) {
      if (err.code !== "auth/user-not-found") {
        console.error(`[DeleteAuth] Failed to delete ${u}:`, err.message);
      }
    }
  }

  return { success: true, deleted, count: deleted.length };
}

// Direct CLI invocation
if (process.argv[1] && /delete-auth-user\.mjs$/i.test(process.argv[1].replace(/\\/g, "/"))) {
  const target = process.argv[2];
  if (!target) {
    console.log("Usage: node scripts/delete-auth-user.mjs <phone_or_email_or_uid>");
    process.exit(1);
  }

  const clean = normalizeMobile(target);
  const is10 = clean.length === 10;
  const isEmail = target.includes("@");

  deleteAuthUserByIdentifiers({
    uid: !is10 && !isEmail ? target : undefined,
    phone: is10 ? clean : undefined,
    email: isEmail ? target : undefined,
  })
    .then((res) => {
      console.log(`✅ Done. Deleted ${res.count} account(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal:", err.message);
      process.exit(1);
    });
}

