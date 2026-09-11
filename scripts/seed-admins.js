// ============================================================
// SEED ADMINS
//
// Creates the 5 initial admin accounts against the 5 roles
// already seeded in admin_roles (super_admin, scholarship_admin,
// reviewer, finance_admin, viewer).
//
// Usage:
//   node scripts/seed-admins.js
//
// Edit the ADMINS array below with real names/emails before
// running. Generated passwords are printed once to the console
// — deliver them to each admin securely and require a password
// change on first login (POST /api/v1/admin/me/change-password).
//
// Safe to re-run: skips any email that already exists.
// ============================================================

import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../src/config/db.js";

// ----------------------------------------------------------
// EDIT THIS LIST before running.
// roleCode must match admin_roles.code:
//   super_admin | scholarship_admin | reviewer | finance_admin | viewer
// ----------------------------------------------------------

const ADMINS = [
  { fullName: "Super Admin", email: "superadmin@bondadafoundation.org", mobile: null, roleCode: "super_admin" },
  { fullName: "Scholarship Admin", email: "scholarship.admin@bondadafoundation.org", mobile: null, roleCode: "scholarship_admin" },
  { fullName: "Reviewer", email: "reviewer@bondadafoundation.org", mobile: null, roleCode: "reviewer" },
  { fullName: "Finance Admin", email: "finance.admin@bondadafoundation.org", mobile: null, roleCode: "finance_admin" },
  { fullName: "Viewer", email: "viewer@bondadafoundation.org", mobile: null, roleCode: "viewer" },
];

const generatePassword = () => crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "!1A";

const run = async () => {
  const created = [];

  for (const admin of ADMINS) {
    const [roleRows] = await pool.execute(
      "SELECT id FROM admin_roles WHERE code = ? LIMIT 1",
      [admin.roleCode]
    );

    if (!roleRows.length) {
      console.error(`Skipping ${admin.email}: role '${admin.roleCode}' not found.`);
      continue;
    }

    const [existingRows] = await pool.execute(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [admin.email]
    );

    if (existingRows.length) {
      console.log(`Skipping ${admin.email}: already exists.`);
      continue;
    }

    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await pool.execute("CALL sp_admin_create(?, ?, ?, ?, ?)", [
      roleRows[0].id,
      admin.fullName,
      admin.email,
      admin.mobile,
      passwordHash,
    ]);

    created.push({ ...admin, tempPassword });
  }

  console.log("\n=== Admin accounts created ===");
  console.log("Deliver these credentials securely. Each admin should change their password on first login.\n");

  for (const admin of created) {
    console.log(`${admin.roleCode.padEnd(20)} ${admin.email.padEnd(38)} temp password: ${admin.tempPassword}`);
  }

  if (!created.length) {
    console.log("No new admins were created (all emails already exist, or roles are missing).");
  }

  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
