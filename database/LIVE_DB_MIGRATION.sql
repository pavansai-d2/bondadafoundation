-- ============================================================
-- BONDADA FOUNDATION — LIVE DATABASE MIGRATION
-- Date: 30 Sep 2026
-- Run on: phpMyAdmin → bondada_foundation database
-- ============================================================
-- SAFE TO RUN ON LIVE DB:
--   ✅ No DROP, no DELETE, no TRUNCATE
--   ✅ All inserts use INSERT IGNORE (skips if already exists)
--   ✅ Zero changes to any existing table columns or schema
--   ✅ Existing applications, documents, users → UNTOUCHED
--   ✅ Can be run again without causing any harm
-- ============================================================
--
-- What this migration does:
--   1. Add 'diploma' scholarship program (new row, id=6)
--   2. Seed document_type_config for ALL 5 existing programs
--      (table is empty in live DB — this fills it properly)
--   3. document_type_config for diploma as well
--   4. Confirms status_transition_rules are complete
--      (they already are — just verified, nothing added)
--
-- ============================================================

USE bondada_foundation;

-- ============================================================
-- STEP 1 — ADD DIPLOMA SCHOLARSHIP PROGRAM
--
-- Live DB currently has id 1-5 (dgk-ssc, dgk-intermediate,
-- srk, apj, vidya-asara). We add diploma as id=6.
-- INSERT IGNORE skips silently if it already exists.
-- ============================================================

INSERT IGNORE INTO `scholarship_programs`
    (`id`, `code`, `name`, `subtitle`, `description`, `status`)
VALUES
    (6, 'diploma', 'Bondada Nirmalavathi Scholarship', 'Diploma Level',
     'For students pursuing Diploma programmes.', 'active');

-- ============================================================
-- STEP 2 — SEED document_type_config FOR ALL PROGRAMS
--
-- Live DB dump shows document_type_config table is EMPTY
-- (no INSERT rows in the dump). This seeds it for all 6
-- programs (1-5 existing + 6 diploma).
-- INSERT IGNORE skips any row that already exists.
-- ============================================================

INSERT IGNORE INTO `document_type_config`
    (`program_id`, `document_code`, `label`, `is_required`, `sort_order`)
SELECT sp.id, d.document_code, d.label, 1, d.sort_order
FROM `scholarship_programs` sp,
(
    SELECT 'aadhaar'              AS document_code, 'Aadhaar Card'          AS label, 1 AS sort_order
    UNION ALL SELECT 'photo',             'Passport Size Photo',   2
    UNION ALL SELECT 'marks_memo',        'Marks Certificates',    3
    UNION ALL SELECT 'income_certificate','Income Certificate',    4
    UNION ALL SELECT 'bank_passbook',     'Bank Passbook',         5
    UNION ALL SELECT 'ration_card',       'Ration Card',           6
) d
WHERE sp.id IN (1, 2, 3, 4, 5, 6);

-- ============================================================
-- STEP 3 — VERIFY STATUS TRANSITION RULES ARE COMPLETE
--
-- Live DB already has all 6 global rules (program_id IS NULL):
--   applied → under_review       (id=1)
--   under_review → eligible       (id=2)
--   under_review → not_eligible   (id=3)
--   eligible → approved           (id=4)
--   not_eligible → rejected       (id=5)
--   approved → disbursed          (id=6)
--
-- These global rules automatically cover diploma because
-- sp_scholarship_status_change queries:
--   WHERE (program_id IS NULL OR program_id = v_program_id)
--
-- Nothing to insert here.
-- ============================================================

-- ============================================================
-- STEP 4 — VERIFY (run these SELECTs to confirm everything)
-- ============================================================

-- Check diploma program exists:
SELECT id, code, name, subtitle, status
FROM scholarship_programs
ORDER BY id;

-- Check document_type_config is now populated:
SELECT sp.code AS scholarship, dtc.document_code, dtc.label, dtc.is_required
FROM document_type_config dtc
JOIN scholarship_programs sp ON sp.id = dtc.program_id
ORDER BY sp.id, dtc.sort_order;

-- Confirm status rules are intact (should show 6 rows):
SELECT id, program_id, from_status, to_status, required_permission_code
FROM status_transition_rules
ORDER BY sort_order;

-- ============================================================
-- DONE. No existing data was modified.
-- ============================================================
