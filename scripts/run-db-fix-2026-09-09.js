// ============================================================
// ONE-OFF FIX — 2026-09-09
//
// Fixes two live production issues at once:
//   1. sp_scholarship_application_create argument-count mismatch
//      ("expected 25, got 28")
//   2. scholarship_programs (and other reference tables) coming
//      back empty, causing "Selected scholarship does not exist."
//
// See database/FIX_2026-09-09_procedure_and_reseed.sql for the
// full explanation and the exact SQL this script runs.
//
// WHY A SCRIPT INSTEAD OF RUNNING THE .sql FILE DIRECTLY:
// GoDaddy's Database panel (Settings > Database > Browse tables)
// only browses/edits table rows — no raw SQL box — and the DB host
// shown in your own logs (10.204.129.166) is a private address
// only reachable from inside GoDaddy's hosting network, not from
// an external MySQL client. This script reuses the app's own DB
// connection (src/config/db.js), so it only needs to run inside
// the same hosting environment the app already runs in.
//
// HOW TO RUN THIS ON YOUR GODADDY NODE.JS HOSTING:
//   1. Deploy this file as part of a normal update to your
//      PREVIEW app (not Publish) — Overview > Update Preview.
//   2. Temporarily change the app's start command so it runs this
//      script instead of the server. In .airo/config.json, change:
//          "serveCommand": "NODE_ENV=production npm start"
//      to:
//          "serveCommand": "NODE_ENV=production node scripts/run-db-fix-2026-09-09.js"
//      (Alternatively, temporarily change package.json's "start"
//      script to `node scripts/run-db-fix-2026-09-09.js` if that's
//      easier to edit from where you deploy.)
//   3. Update Preview again and open Logs > Preview. You should
//      see the "DB FIX COMPLETE" summary printed below, or a clear
//      error if something went wrong (e.g. wrong credentials).
//   4. Change serveCommand / package.json's start script BACK to
//      `NODE_ENV=production npm start` (or `node src/server.js`)
//      before publishing again. Leaving this script as the start
//      command would just re-run it (harmless — every statement
//      here is idempotent — but it never actually starts the API).
//   5. Publish to Live once the normal start command is restored
//      and you've confirmed the fix in Preview.
//
// Every statement below is idempotent: DROP+CREATE for the
// procedure, INSERT IGNORE (keyed off existing UNIQUE constraints)
// for reference data. Re-running this script is always safe and
// never touches scholarship_applications, scholarship_documents,
// admins, or contact_messages.
// ============================================================

import pool from "../src/config/db.js";

const SP_SCHOLARSHIP_APPLICATION_CREATE = `
CREATE PROCEDURE sp_scholarship_application_create(
    IN p_year INT,
    IN p_program_application_number VARCHAR(100),
    IN p_scholarship_program_id INT UNSIGNED,
    IN p_full_name VARCHAR(150),
    IN p_date_of_birth DATE,
    IN p_aadhaar_number VARCHAR(12),
    IN p_mobile_number VARCHAR(15),
    IN p_email VARCHAR(150),
    IN p_referred_by_bondada_employee TINYINT(1),
    IN p_employee_name VARCHAR(150),
    IN p_employee_id VARCHAR(50),
    IN p_parent_guardian_name VARCHAR(150),
    IN p_parent_guardian_aadhaar VARCHAR(12),
    IN p_parent_guardian_mobile VARCHAR(15),
    IN p_occupation VARCHAR(150),
    IN p_annual_family_income DECIMAL(12,2),
    IN p_ration_card_type VARCHAR(50),
    IN p_ration_card_number VARCHAR(100),
    IN p_previously_applied TINYINT(1),
    IN p_previous_application_year INT,
    IN p_previous_scholarship_name VARCHAR(255),
    IN p_present_address TEXT,
    IN p_bank_account_holder_name VARCHAR(150),
    IN p_bank_name VARCHAR(150),
    IN p_account_number VARCHAR(50),
    IN p_ifsc_code VARCHAR(20),
    IN p_branch_name VARCHAR(150),
    IN p_academic_data JSON
)
proc_body: BEGIN
    DECLARE v_application_id BIGINT UNSIGNED;
    DECLARE v_application_number VARCHAR(50);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;

    INSERT INTO scholarship_applications (
        program_application_number, scholarship_program_id,
        full_name, date_of_birth, aadhaar_number, mobile_number, email,
        referred_by_bondada_employee, employee_name, employee_id,
        parent_guardian_name, parent_guardian_aadhaar, parent_guardian_mobile,
        occupation, annual_family_income, ration_card_type, ration_card_number,
        previously_applied, previous_application_year, previous_scholarship_name,
        present_address, bank_account_holder_name, bank_name, account_number,
        ifsc_code, branch_name
    ) VALUES (
        p_program_application_number, p_scholarship_program_id,
        p_full_name, p_date_of_birth, p_aadhaar_number, p_mobile_number, p_email,
        p_referred_by_bondada_employee, p_employee_name, p_employee_id,
        p_parent_guardian_name, p_parent_guardian_aadhaar, p_parent_guardian_mobile,
        p_occupation, p_annual_family_income, p_ration_card_type, p_ration_card_number,
        p_previously_applied, p_previous_application_year, p_previous_scholarship_name,
        p_present_address, p_bank_account_holder_name, p_bank_name, p_account_number,
        p_ifsc_code, p_branch_name
    );

    SET v_application_id = LAST_INSERT_ID();
    SET v_application_number = CONCAT('BF-', p_year, '-', LPAD(v_application_id, 4, '0'));

    UPDATE scholarship_applications
    SET application_number = v_application_number
    WHERE id = v_application_id;

    INSERT INTO scholarship_academic_details (application_id, academic_data)
    VALUES (v_application_id, p_academic_data);

    INSERT INTO scholarship_status_history (application_id, old_status, new_status, remarks)
    VALUES (v_application_id, NULL, 'applied', 'Application submitted.');

    COMMIT;

    SELECT v_application_id AS application_id, v_application_number AS application_number;
END
`;

const statements = [
  {
    label: "Drop old sp_scholarship_application_create",
    sql: "DROP PROCEDURE IF EXISTS sp_scholarship_application_create",
  },
  {
    label: "Recreate sp_scholarship_application_create (28 params)",
    sql: SP_SCHOLARSHIP_APPLICATION_CREATE,
  },
  {
    label: "Reseed scholarship_programs",
    sql: `INSERT IGNORE INTO scholarship_programs (id, code, name, subtitle, description) VALUES
      (1, 'dgk-ssc', 'Bondada Nirmalavathi Scholarship', 'SSC Level', 'For students who have completed SSC.'),
      (2, 'dgk-intermediate', 'Bondada Nirmalavathi Scholarship', 'Intermediate Level', 'For students pursuing Intermediate.'),
      (3, 'srk', 'Bondada Nirmalavathi Scholarship', 'Under Graduation Level', 'For undergraduate students.'),
      (4, 'apj', 'Bondada Nirmalavathi Scholarship', 'Post Graduation Level', 'For postgraduate students.'),
      (5, 'vidya-asara', 'Bondada Vidya Asara', 'Complete Education Support', 'Complete educational support and financial assistance.')`,
  },
  {
    label: "Reseed status_transition_rules",
    sql: `INSERT IGNORE INTO status_transition_rules
      (program_id, from_status, to_status, required_permission_code, system_allowed, sort_order)
      VALUES
      (NULL, 'applied',      'under_review', 'scholarship.review',       0, 10),
      (NULL, 'under_review', 'eligible',     'scholarship.eligible',     0, 20),
      (NULL, 'under_review', 'not_eligible', 'scholarship.not_eligible', 0, 30),
      (NULL, 'eligible',     'approved',     'scholarship.approve',      0, 40),
      (NULL, 'approved',     'disbursed',    'scholarship.disburse',     0, 50),
      (NULL, 'not_eligible', 'rejected',     'scholarship.reject',       0, 60)`,
  },
  {
    label: "Reseed document_type_config",
    sql: `INSERT IGNORE INTO document_type_config (program_id, document_code, label, is_required, sort_order)
      SELECT sp.id, d.document_code, d.label, 1, d.sort_order
      FROM scholarship_programs sp,
      (
          SELECT 'aadhaar' AS document_code, 'Aadhaar Card' AS label, 1 AS sort_order
          UNION ALL SELECT 'photo', 'Passport Size Photo', 2
          UNION ALL SELECT 'marks_memo', 'Marks Certificates', 3
          UNION ALL SELECT 'income_certificate', 'Income Certificate', 4
          UNION ALL SELECT 'bank_passbook', 'Bank Passbook', 5
          UNION ALL SELECT 'ration_card', 'Ration Card', 6
      ) d`,
  },
  {
    label: "Reseed admin_roles",
    sql: `INSERT IGNORE INTO admin_roles (id, name, code, description) VALUES
      (1, 'Super Admin', 'super_admin', 'Full access to everything, including admin management.'),
      (2, 'Scholarship Admin', 'scholarship_admin', 'Manages scholarship applications end-to-end.'),
      (3, 'Reviewer', 'reviewer', 'Reviews applications and moves them through the workflow.'),
      (4, 'Finance Admin', 'finance_admin', 'Handles approvals and disbursements.'),
      (5, 'Viewer', 'viewer', 'Read-only access.')`,
  },
  {
    label: "Reseed admin_permissions",
    sql: `INSERT IGNORE INTO admin_permissions (name, code, module, description) VALUES
      ('View Applications', 'scholarship.view', 'scholarship', 'View scholarship applications.'),
      ('Move to Review', 'scholarship.review', 'scholarship', 'Move an application into under_review.'),
      ('Mark Eligible', 'scholarship.eligible', 'scholarship', 'Mark an application eligible.'),
      ('Mark Not Eligible', 'scholarship.not_eligible', 'scholarship', 'Mark an application not eligible.'),
      ('Approve', 'scholarship.approve', 'scholarship', 'Approve an application.'),
      ('Reject', 'scholarship.reject', 'scholarship', 'Reject an application.'),
      ('Disburse', 'scholarship.disburse', 'scholarship', 'Mark a scholarship as disbursed.'),
      ('View Documents', 'scholarship.document_view', 'scholarship', 'View applicant documents.'),
      ('Download Documents', 'scholarship.document_download', 'scholarship', 'Download applicant documents.'),
      ('View Contact Messages', 'contact.view', 'contact', 'View contact-us messages.'),
      ('Respond To Contact Messages', 'contact.respond', 'contact', 'Update status of contact messages.'),
      ('Delete Contact Messages', 'contact.delete', 'contact', 'Delete contact messages.'),
      ('View Admins', 'admin.view', 'admin', 'View admin accounts.'),
      ('Create Admins', 'admin.create', 'admin', 'Create new admin accounts.'),
      ('Update Admins', 'admin.update', 'admin', 'Update admin accounts.'),
      ('Disable Admins', 'admin.disable', 'admin', 'Enable/disable admin accounts.'),
      ('View Audit Log', 'audit.view', 'audit', 'View the admin audit log.')`,
  },
  {
    label: "Reseed admin_role_permissions (super_admin: all)",
    sql: `INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
      SELECT 1, id FROM admin_permissions`,
  },
  {
    label: "Reseed admin_role_permissions (scholarship_admin)",
    sql: `INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
      SELECT 2, id FROM admin_permissions WHERE module IN ('scholarship', 'contact') OR code = 'audit.view'`,
  },
  {
    label: "Reseed admin_role_permissions (reviewer)",
    sql: `INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
      SELECT 3, id FROM admin_permissions WHERE code IN (
          'scholarship.view', 'scholarship.review', 'scholarship.eligible',
          'scholarship.not_eligible',
          'scholarship.document_view', 'scholarship.document_download'
      )`,
  },
  {
    label: "Reseed admin_role_permissions (finance_admin)",
    sql: `INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
      SELECT 4, id FROM admin_permissions WHERE code IN (
          'scholarship.view', 'scholarship.approve',
          'scholarship.reject', 'scholarship.disburse',
          'scholarship.document_view', 'scholarship.document_download'
      )`,
  },
  {
    label: "Reseed admin_role_permissions (viewer)",
    sql: `INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
      SELECT 5, id FROM admin_permissions WHERE code IN (
          'scholarship.view', 'contact.view', 'scholarship.document_view'
      )`,
  },
];

const run = async () => {
  console.log("=== DB FIX 2026-09-09 — starting ===");

  const connection = await pool.getConnection();

  try {
    for (const { label, sql } of statements) {
      process.stdout.write(`- ${label} ... `);
      await connection.query(sql);
      console.log("ok");
    }

    console.log("\n=== Verifying ===");

    const [[{ programCount }]] = await connection.query(
      "SELECT COUNT(*) AS programCount FROM scholarship_programs"
    );
    const [[{ dgkSscExists }]] = await connection.query(
      "SELECT COUNT(*) AS dgkSscExists FROM scholarship_programs WHERE code = 'dgk-ssc'"
    );
    const [[{ adminCount }]] = await connection.query(
      "SELECT COUNT(*) AS adminCount FROM admins"
    );
    const [procRows] = await connection.query(
      `SELECT COUNT(*) AS paramCount
       FROM information_schema.parameters
       WHERE SPECIFIC_SCHEMA = DATABASE()
         AND SPECIFIC_NAME = 'sp_scholarship_application_create'
         AND PARAMETER_MODE IS NOT NULL`
    );

    console.log(`scholarship_programs row count: ${programCount}`);
    console.log(`dgk-ssc present: ${dgkSscExists > 0 ? "YES" : "NO — still missing!"}`);
    console.log(`sp_scholarship_application_create parameter count: ${procRows[0].paramCount} (should be 28)`);
    console.log(
      `admins row count: ${adminCount}` +
        (adminCount === 0
          ? "  <-- 0 admins found. Run `node scripts/seed-admins.js` (after editing its ADMINS list) to restore admin logins."
          : "")
    );

    console.log("\n=== DB FIX COMPLETE ===");
    process.exit(0);
  } catch (error) {
    console.error("\n=== DB FIX FAILED ===");
    console.error(error);
    process.exit(1);
  } finally {
    connection.release();
  }
};

run();