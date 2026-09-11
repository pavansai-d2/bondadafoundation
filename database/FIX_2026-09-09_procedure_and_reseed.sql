-- ============================================================
-- FIX — 2026-09-09
--
-- Two independent problems, both confirmed from your logs:
--
-- 1) sp_scholarship_application_create on the LIVE database only
--    accepted 25 parameters, while the application code (and this
--    repo's database/02_procedures_scholarship.sql) calls it with
--    28. That mismatch is what threw:
--      "Incorrect number of arguments for PROCEDURE
--       db_uya8c9cpu1.sp_scholarship_application_create;
--       expected 25, got 28"
--    This file's procedure below is IDENTICAL to the one already
--    in database/02_procedures_scholarship.sql — this file exists
--    so you can re-apply JUST the procedure, without re-running
--    the full schema file.
--
-- 2) Right after that got patched, submissions started failing
--    with "Selected scholarship does not exist." (HTTP 400) for
--    scholarshipCode "dgk-ssc" — even though that program was
--    fetched successfully by GET a short time earlier in the same
--    log. The only way that check fails is an empty/missing row
--    in scholarship_programs. This points to database/00_schema.sql
--    (which contains CREATE TABLE, and would have needed a DROP
--    first) having been re-run against the live database at some
--    point while fixing (1) above, which resets scholarship_programs
--    (and the other reference tables) to empty — the seed step
--    (database/01_seed.sql) was never re-run afterward.
--
--    IMPORTANT: if any real applicants had already submitted before
--    that reset, and scholarship_applications / scholarship_documents
--    were also dropped and recreated, that submitted data is gone
--    unless you have a backup. Check the "Data" tab for
--    scholarship_applications in the GoDaddy database browser before
--    doing anything else. If it's non-empty, this reseed script is
--    still safe to run (it only touches the reference/lookup tables
--    below, via INSERT IGNORE, and will not touch or duplicate
--    scholarship_applications, scholarship_documents, admins, or
--    contact_messages).
--
-- Every statement below is written to be safe to run more than
-- once: DROP PROCEDURE IF EXISTS / CREATE PROCEDURE for the
-- procedure, and INSERT IGNORE (keyed off each table's existing
-- UNIQUE constraints) for the reference data, so re-running this
-- file after it has already succeeded is a no-op, not a duplicate
-- or an error.
--
-- HOW TO RUN THIS on GoDaddy's managed Node.js hosting:
-- GoDaddy's "Database" panel (Settings > Database > Browse tables)
-- only lets you browse/edit table rows — it has no raw SQL query
-- box, and the DB host (10.204.129.166) is a private address only
-- reachable from inside GoDaddy's own network, not from an external
-- MySQL client on your laptop. So the practical way to run this is
-- from inside the app itself, once, via the companion script:
--     scripts/run-db-fix-2026-09-09.js
-- See the instructions at the top of that file.
-- ============================================================


-- ============================================================
-- 1) PROCEDURE FIX
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_application_create;

DELIMITER $$

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
END $$

DELIMITER ;


-- ============================================================
-- 2) REFERENCE-DATA RESEED (idempotent — INSERT IGNORE only)
-- ============================================================

INSERT IGNORE INTO scholarship_programs (id, code, name, subtitle, description) VALUES
    (1, 'dgk-ssc', 'Bondada Nirmalavathi Scholarship', 'SSC Level', 'For students who have completed SSC.'),
    (2, 'dgk-intermediate', 'Bondada Nirmalavathi Scholarship', 'Intermediate Level', 'For students pursuing Intermediate.'),
    (3, 'srk', 'Bondada Nirmalavathi Scholarship', 'Under Graduation Level', 'For undergraduate students.'),
    (4, 'apj', 'Bondada Nirmalavathi Scholarship', 'Post Graduation Level', 'For postgraduate students.'),
    (5, 'vidya-asara', 'Bondada Vidya Asara', 'Complete Education Support', 'Complete educational support and financial assistance.');

INSERT IGNORE INTO status_transition_rules
    (program_id, from_status, to_status, required_permission_code, system_allowed, sort_order)
VALUES
    (NULL, 'applied',      'under_review', 'scholarship.review',       0, 10),
    (NULL, 'under_review', 'eligible',     'scholarship.eligible',     0, 20),
    (NULL, 'under_review', 'not_eligible', 'scholarship.not_eligible', 0, 30),
    (NULL, 'eligible',     'approved',     'scholarship.approve',      0, 40),
    (NULL, 'approved',     'disbursed',    'scholarship.disburse',     0, 50),
    (NULL, 'not_eligible', 'rejected',     'scholarship.reject',       0, 60);

INSERT IGNORE INTO document_type_config (program_id, document_code, label, is_required, sort_order)
SELECT sp.id, d.document_code, d.label, 1, d.sort_order
FROM scholarship_programs sp,
(
    SELECT 'aadhaar' AS document_code, 'Aadhaar Card' AS label, 1 AS sort_order
    UNION ALL SELECT 'photo', 'Passport Size Photo', 2
    UNION ALL SELECT 'marks_memo', 'Marks Certificates', 3
    UNION ALL SELECT 'income_certificate', 'Income Certificate', 4
    UNION ALL SELECT 'bank_passbook', 'Bank Passbook', 5
    UNION ALL SELECT 'ration_card', 'Ration Card', 6
) d;

INSERT IGNORE INTO admin_roles (id, name, code, description) VALUES
    (1, 'Super Admin', 'super_admin', 'Full access to everything, including admin management.'),
    (2, 'Scholarship Admin', 'scholarship_admin', 'Manages scholarship applications end-to-end.'),
    (3, 'Reviewer', 'reviewer', 'Reviews applications and moves them through the workflow.'),
    (4, 'Finance Admin', 'finance_admin', 'Handles approvals and disbursements.'),
    (5, 'Viewer', 'viewer', 'Read-only access.');

INSERT IGNORE INTO admin_permissions (name, code, module, description) VALUES
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
    ('View Audit Log', 'audit.view', 'audit', 'View the admin audit log.');

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT 1, id FROM admin_permissions;

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT 2, id FROM admin_permissions WHERE module IN ('scholarship', 'contact') OR code = 'audit.view';

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT 3, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'scholarship.review', 'scholarship.eligible',
    'scholarship.not_eligible',
    'scholarship.document_view', 'scholarship.document_download'
);

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT 4, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'scholarship.approve',
    'scholarship.reject', 'scholarship.disburse',
    'scholarship.document_view', 'scholarship.document_download'
);

INSERT IGNORE INTO admin_role_permissions (role_id, permission_id)
SELECT 5, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'contact.view', 'scholarship.document_view'
);

-- NOTE: admins themselves are intentionally NOT reseeded here —
-- if your admin accounts also disappeared, run
-- `node scripts/seed-admins.js` separately after editing the
-- ADMINS list in that file with real names/emails. It's already
-- safe to re-run (skips any email that already exists).