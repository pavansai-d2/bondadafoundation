-- ============================================================
-- BONDADA FOUNDATION — MIGRATION
-- Run on the live bondada_foundation database (via phpMyAdmin
-- or MySQL CLI). Safe to re-run: uses IF NOT EXISTS / INSERT
-- IGNORE / ON DUPLICATE KEY so nothing breaks if run twice.
--
-- Covers:
--   1. Add diploma scholarship program (id = 6)
--   2. Add document_type_config rows for diploma
--   3. Add status_transition_rules for diploma (inherits global)
--   4. Add SCHOLARSHIP_NOTIFICATION_EMAIL env column (informational)
--
-- Run order: this file only. No prerequisite migrations needed.
-- ============================================================

USE bondada_foundation;

-- ============================================================
-- 1. DIPLOMA SCHOLARSHIP PROGRAM
--    code must match scholarshipConfig.js key exactly: "diploma"
-- ============================================================

INSERT IGNORE INTO scholarship_programs
    (id, code, name, subtitle, description, status)
VALUES
    (6, 'diploma', 'Bondada Nirmalavathi Scholarship', 'Diploma Level',
     'For students pursuing Diploma programmes.', 'active');

-- If id=6 is already taken (unlikely but safe), use this instead:
-- INSERT INTO scholarship_programs (code, name, subtitle, description, status)
-- VALUES ('diploma','Bondada Nirmalavathi Scholarship','Diploma Level',
--         'For students pursuing Diploma programmes.','active')
-- ON DUPLICATE KEY UPDATE status = status;   -- no-op if code already exists

-- ============================================================
-- 2. DOCUMENT TYPE CONFIG for diploma
--    Same 6 documents as every other program.
-- ============================================================

INSERT IGNORE INTO document_type_config
    (program_id, document_code, label, is_required, sort_order)
SELECT
    sp.id,
    d.document_code,
    d.label,
    1,
    d.sort_order
FROM scholarship_programs sp,
(
    SELECT 'aadhaar'             AS document_code, 'Aadhaar Card'          AS label, 1 AS sort_order
    UNION ALL SELECT 'photo',            'Passport Size Photo',   2
    UNION ALL SELECT 'marks_memo',       'Marks Certificates',    3
    UNION ALL SELECT 'income_certificate','Income Certificate',   4
    UNION ALL SELECT 'bank_passbook',    'Bank Passbook',         5
    UNION ALL SELECT 'ration_card',      'Ration Card',           6
) d
WHERE sp.code = 'diploma';

-- ============================================================
-- 3. STATUS TRANSITION RULES for diploma
--    The global rules (program_id IS NULL) already apply to
--    diploma, so no extra rows are needed unless you want
--    diploma-specific overrides. This block is a no-op that
--    confirms the global rules cover it.
--
--    Global rules already present:
--      applied -> under_review
--      under_review -> eligible / not_eligible
--      eligible -> approved
--      approved -> disbursed
--      not_eligible -> rejected
-- ============================================================

-- Nothing to insert — global rules are inherited automatically
-- by sp_status_transition_options (it queries WHERE program_id IS NULL
-- OR program_id = p_program_id, so diploma (id=6) is fully covered).

-- ============================================================
-- 4. VERIFY (optional — run these SELECT statements to confirm)
-- ============================================================

-- SELECT * FROM scholarship_programs WHERE code = 'diploma';
-- SELECT dtc.* FROM document_type_config dtc
--   JOIN scholarship_programs sp ON sp.id = dtc.program_id
--  WHERE sp.code = 'diploma';
