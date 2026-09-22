// ============================================================
// DIAGNOSTIC — Why "Change Status" shows no buttons
//
// This does NOT change anything. It only reads and prints, so it's
// completely safe to run on the live database.
//
// It checks the two things that drive the admin panel's
// "Change Status" buttons:
//   1. status_transition_rules — the rows that say which status
//      can move to which (e.g. applied -> under_review).
//   2. Your logged-in admin's role + the permissions attached to
//      that role via admin_role_permissions.
//
// The buttons only appear when BOTH of these are true for a given
// transition:
//   - a matching row exists in status_transition_rules
//   - your admin's permissions include that row's
//     required_permission_code (or it has none)
//
// If either is empty/missing, you get exactly what's in the
// screenshot: the modal loads fine, but "Change Status" has no
// buttons under it, with no error shown.
//
// HOW TO RUN THIS on your GoDaddy Node.js hosting (same method as
// scripts/run-db-fix-2026-09-09.js):
//   1. Deploy this file to PREVIEW (Overview > Update Preview).
//   2. Temporarily change the start command to:
//        node scripts/check-status-workflow.js
//      (in .airo/config.json's "serveCommand", or package.json's
//      "start" script — whichever you edited last time)
//   3. Update Preview again, open Logs > Preview, and read the
//      report this prints.
//   4. Change the start command back to your normal one
//      (NODE_ENV=production npm start) before doing anything else.
//
// You can also run it locally with `node scripts/check-status-workflow.js`
// if your .env there points at the same live database.
// ============================================================

import pool from "../src/config/db.js";

const line = () => console.log("------------------------------------------------------------");

const run = async () => {
  console.log("STATUS WORKFLOW DIAGNOSTIC");
  line();

  // ----------------------------------------------------------
  // 1) status_transition_rules
  // ----------------------------------------------------------
  const [rules] = await pool.query(
    "SELECT program_id, from_status, to_status, required_permission_code, system_allowed, sort_order FROM status_transition_rules ORDER BY sort_order"
  );

  console.log(`status_transition_rules: ${rules.length} row(s) found`);

  if (rules.length === 0) {
    console.log("  -> EMPTY. This table needs the rows from");
    console.log("     database/FIX_2026-09-09_procedure_and_reseed.sql");
    console.log("     (or database/01_seed.sql) inserted before ANY status");
    console.log("     button will ever appear, for any admin.");
  } else {
    rules.forEach((r) => {
      console.log(
        `  [program_id=${r.program_id ?? "ALL"}] ${r.from_status} -> ${r.to_status}` +
          `  (requires: ${r.required_permission_code || "none"})`
      );
    });
  }

  line();

  // ----------------------------------------------------------
  // 2) admin_permissions / admin_roles / admin_role_permissions
  // ----------------------------------------------------------
  const [[{ permCount }]] = await pool.query(
    "SELECT COUNT(*) AS permCount FROM admin_permissions"
  );
  const [[{ roleCount }]] = await pool.query(
    "SELECT COUNT(*) AS roleCount FROM admin_roles"
  );
  const [[{ rolePermCount }]] = await pool.query(
    "SELECT COUNT(*) AS rolePermCount FROM admin_role_permissions"
  );

  console.log(`admin_permissions: ${permCount} row(s)`);
  console.log(`admin_roles: ${roleCount} row(s)`);
  console.log(`admin_role_permissions (links): ${rolePermCount} row(s)`);

  if (permCount === 0 || roleCount === 0 || rolePermCount === 0) {
    console.log("  -> One of these is EMPTY. No admin can have any permission");
    console.log("     until these are seeded (see FIX_2026-09-09 reseed script).");
  }

  line();

  // ----------------------------------------------------------
  // 3) Every admin account + their role + resolved permissions
  // ----------------------------------------------------------
  const [admins] = await pool.query(
    `SELECT a.id, a.full_name, a.email, a.status, a.role_id, r.code AS role_code, r.name AS role_name
     FROM admins a
     LEFT JOIN admin_roles r ON r.id = a.role_id
     ORDER BY a.id`
  );

  console.log(`admins: ${admins.length} account(s) found`);
  line();

  for (const admin of admins) {
    console.log(`Admin #${admin.id} — ${admin.full_name} <${admin.email}> — status: ${admin.status}`);

    if (!admin.role_id || !admin.role_code) {
      console.log(`  role_id: ${admin.role_id ?? "NULL"}  -> NOT LINKED to a valid row in admin_roles.`);
      console.log("     This admin will have ZERO permissions no matter what.");
      line();
      continue;
    }

    console.log(`  role: ${admin.role_name} (${admin.role_code})`);

    const [perms] = await pool.query(
      `SELECT p.code FROM admin_role_permissions rp
       JOIN admin_permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.code`,
      [admin.role_id]
    );

    if (perms.length === 0) {
      console.log("  permissions: NONE — this role has no rows in admin_role_permissions.");
      console.log("     This is why 'Change Status' shows no buttons for this admin.");
    } else {
      console.log(`  permissions (${perms.length}): ${perms.map((p) => p.code).join(", ")}`);

      const hasReview = perms.some((p) => p.code === "scholarship.review");
      console.log(
        `  can move applied -> under_review? ${hasReview ? "YES" : "NO (missing scholarship.review)"}`
      );
    }

    line();
  }

  console.log("DONE. No data was changed.");
  process.exit(0);
};

run().catch((err) => {
  console.error("DIAGNOSTIC FAILED:", err);
  process.exit(1);
});
