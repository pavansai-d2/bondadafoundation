-- ============================================================
-- STORED PROCEDURES — SCHOLARSHIP MODULE
-- No OUT params (mysql2-friendly). No inline SQL anywhere in
-- the Node repository — every DB call routes through one of
-- these.
-- ============================================================

USE bondada_foundation;

DELIMITER $$

-- ============================================================
-- PROGRAMS
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_program_list $$
CREATE PROCEDURE sp_scholarship_program_list()
BEGIN
    SELECT id, code, name, subtitle, description, status
    FROM scholarship_programs
    WHERE status = 'active'
    ORDER BY id ASC;
END $$

DROP PROCEDURE IF EXISTS sp_scholarship_program_get_by_code $$
CREATE PROCEDURE sp_scholarship_program_get_by_code(IN p_code VARCHAR(50))
BEGIN
    SELECT id, code, name, subtitle, description, status
    FROM scholarship_programs
    WHERE code = p_code
    LIMIT 1;
END $$

-- ============================================================
-- NUMBERING (atomic, own transaction)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_next_program_number $$
CREATE PROCEDURE sp_scholarship_next_program_number(
    IN p_program_id INT UNSIGNED,
    IN p_year INT
)
proc_body: BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;

    INSERT INTO scholarship_application_sequences (scholarship_program_id, year, last_number)
    VALUES (p_program_id, p_year, 0)
    ON DUPLICATE KEY UPDATE last_number = last_number;

    UPDATE scholarship_application_sequences
    SET last_number = last_number + 1
    WHERE scholarship_program_id = p_program_id AND year = p_year;

    COMMIT;

    SELECT last_number AS next_number
    FROM scholarship_application_sequences
    WHERE scholarship_program_id = p_program_id AND year = p_year
    LIMIT 1;
END $$

-- ============================================================
-- RECENT-SUBMISSION CHECK
--
-- Lets the frontend resolve "the request failed at the network
-- level, but did it reach the server?" by checking for a match
-- on program + aadhaar created in the last 30 minutes. Returns at
-- most one row (the newest match) and nothing at all if there is
-- no recent match — never returns other applicant data.
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_application_check_recent $$
CREATE PROCEDURE sp_scholarship_application_check_recent(
    IN p_scholarship_program_id INT UNSIGNED,
    IN p_aadhaar_number VARCHAR(12)
)
BEGIN
    SELECT application_number, program_application_number, created_at
    FROM scholarship_applications
    WHERE scholarship_program_id = p_scholarship_program_id
      AND aadhaar_number = p_aadhaar_number
      AND created_at >= (NOW() - INTERVAL 30 MINUTE)
    ORDER BY created_at DESC
    LIMIT 1;
END $$

-- ============================================================
-- APPLICATION CREATE (application + academic_data JSON + initial
-- history — one atomic call)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_application_create $$
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

-- ============================================================
-- DOCUMENTS
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_document_insert $$
CREATE PROCEDURE sp_scholarship_document_insert(
    IN p_application_id BIGINT UNSIGNED,
    IN p_document_type VARCHAR(50),
    IN p_original_name VARCHAR(255),
    IN p_stored_name VARCHAR(255),
    IN p_file_path VARCHAR(500),
    IN p_mime_type VARCHAR(100),
    IN p_file_size BIGINT UNSIGNED
)
proc_body: BEGIN
    DECLARE v_next_version INT UNSIGNED;
    DECLARE v_document_id BIGINT UNSIGNED;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;

    SELECT COALESCE(MAX(document_version), 0) + 1 INTO v_next_version
    FROM scholarship_documents
    WHERE application_id = p_application_id AND document_type = p_document_type;

    UPDATE scholarship_documents
    SET is_current = 0
    WHERE application_id = p_application_id AND document_type = p_document_type;

    INSERT INTO scholarship_documents (
        application_id, document_type, document_version, is_current,
        original_name, stored_name, file_path, mime_type, file_size
    ) VALUES (
        p_application_id, p_document_type, v_next_version, 1,
        p_original_name, p_stored_name, p_file_path, p_mime_type, p_file_size
    );

    SET v_document_id = LAST_INSERT_ID();

    COMMIT;

    SELECT v_document_id AS document_id, v_next_version AS document_version;
END $$

DROP PROCEDURE IF EXISTS sp_scholarship_document_get $$
CREATE PROCEDURE sp_scholarship_document_get(IN p_document_id BIGINT UNSIGNED)
BEGIN
    SELECT * FROM scholarship_documents WHERE id = p_document_id LIMIT 1;
END $$

DROP PROCEDURE IF EXISTS sp_scholarship_document_list_by_application $$
CREATE PROCEDURE sp_scholarship_document_list_by_application(IN p_application_id BIGINT UNSIGNED)
BEGIN
    SELECT id, application_id, document_type, original_name, stored_name, file_path,
           mime_type, file_size, document_version, is_current, created_at
    FROM scholarship_documents
    WHERE application_id = p_application_id
    ORDER BY document_type ASC, document_version ASC;
END $$

-- ============================================================
-- APPLICATION GET / LIST
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_application_get_by_id $$
CREATE PROCEDURE sp_scholarship_application_get_by_id(IN p_id BIGINT UNSIGNED)
BEGIN
    SELECT a.*, sp.code AS scholarship_code, sp.name AS scholarship_name, sp.subtitle AS scholarship_subtitle
    FROM scholarship_applications a
    INNER JOIN scholarship_programs sp ON sp.id = a.scholarship_program_id
    WHERE a.id = p_id
    LIMIT 1;

    SELECT application_id, academic_data FROM scholarship_academic_details WHERE application_id = p_id LIMIT 1;

    SELECT id, application_id, document_type, original_name, stored_name, file_path,
           mime_type, file_size, document_version, is_current, created_at
    FROM scholarship_documents
    WHERE application_id = p_id
    ORDER BY document_type ASC, document_version ASC;
END $$

DROP PROCEDURE IF EXISTS sp_scholarship_application_list $$
CREATE PROCEDURE sp_scholarship_application_list(
    IN p_status VARCHAR(50),
    IN p_scholarship_code VARCHAR(50),
    IN p_search VARCHAR(150),
    IN p_limit INT UNSIGNED,
    IN p_offset INT UNSIGNED
)
BEGIN
    SELECT a.id, a.application_number, a.program_application_number, a.status,
           a.submission_attempt, a.full_name, a.mobile_number, a.email,
           sp.code AS scholarship_code, sp.name AS scholarship_name, sp.subtitle AS scholarship_subtitle,
           a.created_at, a.updated_at
    FROM scholarship_applications a
    INNER JOIN scholarship_programs sp ON sp.id = a.scholarship_program_id
    WHERE (p_status IS NULL OR a.status = p_status)
      AND (p_scholarship_code IS NULL OR sp.code = p_scholarship_code)
      AND (p_search IS NULL
           OR a.application_number LIKE CONCAT('%', p_search, '%')
           OR a.program_application_number LIKE CONCAT('%', p_search, '%')
           OR a.full_name LIKE CONCAT('%', p_search, '%')
           OR a.mobile_number LIKE CONCAT('%', p_search, '%'))
    ORDER BY a.id DESC
    LIMIT p_limit OFFSET p_offset;

    SELECT COUNT(*) AS total
    FROM scholarship_applications a
    INNER JOIN scholarship_programs sp ON sp.id = a.scholarship_program_id
    WHERE (p_status IS NULL OR a.status = p_status)
      AND (p_scholarship_code IS NULL OR sp.code = p_scholarship_code)
      AND (p_search IS NULL
           OR a.application_number LIKE CONCAT('%', p_search, '%')
           OR a.program_application_number LIKE CONCAT('%', p_search, '%')
           OR a.full_name LIKE CONCAT('%', p_search, '%')
           OR a.mobile_number LIKE CONCAT('%', p_search, '%'));
END $$

-- ============================================================
-- STATISTICS (drives AdminDashboard.jsx)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_statistics $$
CREATE PROCEDURE sp_scholarship_statistics()
BEGIN
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('applied','under_review','needs_correction','resubmitted') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'eligible' THEN 1 ELSE 0 END) AS eligible,
        SUM(CASE WHEN status = 'not_eligible' THEN 1 ELSE 0 END) AS nonEligible,
        SUM(CASE WHEN status IN ('approved','disbursed') THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM scholarship_applications;

    SELECT sp.code AS scholarship_code, sp.name AS scholarship_name, sp.subtitle,
           COUNT(a.id) AS total
    FROM scholarship_programs sp
    LEFT JOIN scholarship_applications a ON a.scholarship_program_id = sp.id
    GROUP BY sp.id, sp.code, sp.name, sp.subtitle
    ORDER BY sp.id;
END $$

-- ============================================================
-- STATUS CHANGE (standalone, own transaction)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_status_change $$
CREATE PROCEDURE sp_scholarship_status_change(
    IN p_application_id BIGINT UNSIGNED,
    IN p_new_status VARCHAR(50),
    IN p_review_type VARCHAR(50),
    IN p_reason TEXT,
    IN p_remarks TEXT,
    IN p_changed_by BIGINT UNSIGNED
)
proc_body: BEGIN
    DECLARE v_current_status VARCHAR(50);
    DECLARE v_program_id INT UNSIGNED;
    DECLARE v_rule_exists INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    SELECT status, scholarship_program_id INTO v_current_status, v_program_id
    FROM scholarship_applications WHERE id = p_application_id LIMIT 1;

    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found.';
    END IF;

    SELECT COUNT(*) INTO v_rule_exists
    FROM status_transition_rules
    WHERE from_status = v_current_status AND to_status = p_new_status AND active = 1
      AND (program_id = v_program_id OR program_id IS NULL);

    IF v_rule_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status transition for this application.';
    END IF;

    START TRANSACTION;

    UPDATE scholarship_applications
    SET status = p_new_status,
        admin_remarks = COALESCE(p_remarks, admin_remarks),
        reviewed_by = COALESCE(p_changed_by, reviewed_by),
        reviewed_at = IF(p_changed_by IS NOT NULL, NOW(), reviewed_at)
    WHERE id = p_application_id;

    INSERT INTO scholarship_status_history (application_id, old_status, new_status, remarks, changed_by)
    VALUES (p_application_id, v_current_status, p_new_status, p_remarks, p_changed_by);

    INSERT INTO scholarship_application_reviews (application_id, review_type, decision, reason, remarks, reviewed_by)
    VALUES (p_application_id, COALESCE(p_review_type, 'initial_review'), p_new_status, p_reason, p_remarks, p_changed_by);

    COMMIT;

    SELECT p_application_id AS application_id, v_current_status AS old_status, p_new_status AS new_status;
END $$

DROP PROCEDURE IF EXISTS sp_scholarship_status_history_get $$
CREATE PROCEDURE sp_scholarship_status_history_get(IN p_application_id BIGINT UNSIGNED)
BEGIN
    SELECT h.id, h.application_id, h.old_status, h.new_status, h.remarks, h.changed_by,
           h.changed_at, a.full_name AS changed_by_name
    FROM scholarship_status_history h
    LEFT JOIN admins a ON a.id = h.changed_by
    WHERE h.application_id = p_application_id
    ORDER BY h.id ASC;
END $$

DROP PROCEDURE IF EXISTS sp_status_transition_options $$
CREATE PROCEDURE sp_status_transition_options(
    IN p_current_status VARCHAR(50),
    IN p_program_id INT UNSIGNED
)
BEGIN
    SELECT to_status, required_permission_code, system_allowed
    FROM status_transition_rules
    WHERE from_status = p_current_status AND active = 1
      AND (program_id = p_program_id OR program_id IS NULL)
    ORDER BY sort_order ASC;
END $$

DROP PROCEDURE IF EXISTS sp_document_type_config_by_program $$
CREATE PROCEDURE sp_document_type_config_by_program(IN p_program_id INT UNSIGNED)
BEGIN
    SELECT document_code, label, is_required, sort_order
    FROM document_type_config
    WHERE program_id = p_program_id AND active = 1
    ORDER BY sort_order ASC;
END $$

-- ============================================================
-- DISBURSEMENTS
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_disbursement_create $$
CREATE PROCEDURE sp_scholarship_disbursement_create(
    IN p_application_id BIGINT UNSIGNED,
    IN p_approved_amount DECIMAL(12,2),
    IN p_disbursed_amount DECIMAL(12,2),
    IN p_disbursement_date DATE,
    IN p_payment_reference VARCHAR(150),
    IN p_payment_mode VARCHAR(20),
    IN p_remarks TEXT,
    IN p_created_by BIGINT UNSIGNED
)
BEGIN
    INSERT INTO scholarship_disbursements (
        application_id, approved_amount, disbursed_amount, disbursement_date,
        payment_reference, payment_mode, status, remarks, created_by
    ) VALUES (
        p_application_id, p_approved_amount, p_disbursed_amount, p_disbursement_date,
        p_payment_reference, p_payment_mode, 'completed', p_remarks, p_created_by
    );

    SELECT LAST_INSERT_ID() AS disbursement_id;
END $$

-- ============================================================
-- STATISTICS SCOPED TO ONE PROGRAM (drives /admin/scholarship/:scholarshipId)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_scholarship_statistics_by_program $$
CREATE PROCEDURE sp_scholarship_statistics_by_program(IN p_code VARCHAR(50))
BEGIN
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN a.status IN ('applied','under_review','needs_correction','resubmitted') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN a.status = 'eligible' THEN 1 ELSE 0 END) AS eligible,
        SUM(CASE WHEN a.status = 'not_eligible' THEN 1 ELSE 0 END) AS nonEligible,
        SUM(CASE WHEN a.status IN ('approved','disbursed') THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM scholarship_applications a
    INNER JOIN scholarship_programs sp ON sp.id = a.scholarship_program_id
    WHERE sp.code = p_code;
END $$

DELIMITER ;