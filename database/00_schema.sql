-- ============================================================
-- BONDADA FOUNDATION — COMPLETE DATABASE SCHEMA
-- Run this on a fresh database. One file, no dump dependency.
--
-- Design notes:
-- * Academic details are stored as JSON (academic_data), not one
--   column per field. The frontend's scholarshipConfig.js defines
--   academic fields per program as data — the backend mirrors
--   that. Add/remove/rename an academic field in scholarshipConfig.js
--   and the backend needs ZERO migration.
-- * Status workflow lives in status_transition_rules (data),
--   not hardcoded ENUMs — see 02_config_seed.sql.
-- * Document requirements live in document_type_config (data).
-- ============================================================

CREATE DATABASE IF NOT EXISTS bondada_foundation
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bondada_foundation;

-- ============================================================
-- ADMIN / RBAC
-- ============================================================

CREATE TABLE admin_roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE admin_permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE admin_role_permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_permission (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
);

CREATE TABLE admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    mobile VARCHAR(20) NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active','inactive','locked') NOT NULL DEFAULT 'active',
    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);

CREATE TABLE admin_refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rt_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_rt_admin (admin_id)
);

CREATE TABLE admin_login_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NULL,
    email VARCHAR(150) NOT NULL,
    status ENUM('success','failed','locked') NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    failure_reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_log_admin (admin_id),
    INDEX idx_login_log_created (created_at)
);

CREATE TABLE admin_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NULL,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id BIGINT UNSIGNED NULL,
    old_data JSON NULL,
    new_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_admin (admin_id),
    INDEX idx_audit_created (created_at)
);

-- ============================================================
-- SCHOLARSHIP PROGRAMS
--
-- One row per entry in the frontend's scholarshipConfig.js.
-- code values match scholarshipConfig keys exactly:
-- dgk-ssc, dgk-intermediate, srk, apj, vidya-asara
-- ============================================================

CREATE TABLE scholarship_programs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255) NULL,
    description VARCHAR(500) NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE scholarship_application_sequences (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    scholarship_program_id INT UNSIGNED NOT NULL,
    year INT NOT NULL,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_seq_program_year (scholarship_program_id, year),
    CONSTRAINT fk_seq_program FOREIGN KEY (scholarship_program_id) REFERENCES scholarship_programs(id)
);

-- ============================================================
-- SCHOLARSHIP APPLICATIONS
--
-- Matches ScholarshipForm.jsx's personal/family/bank fields
-- exactly (fullName, dob, aadhar, mobile, email, parentName,
-- parentAadhar, parentMobile, occupation, annualIncome,
-- rationCardType, rationCardNumber, previouslyApplied,
-- previousAppliedYear, previousScholarshipName, presentAddress,
-- accountHolder, bankName, accountNumber, ifsc, branchName).
-- ============================================================

CREATE TABLE scholarship_applications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    application_number VARCHAR(50) NULL UNIQUE,
    program_application_number VARCHAR(100) NULL UNIQUE,
    scholarship_program_id INT UNSIGNED NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'applied',

    -- Personal
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NOT NULL,
    aadhaar_number VARCHAR(12) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    email VARCHAR(150) NOT NULL,

    -- Bondada employee referral
    referred_by_bondada_employee TINYINT(1) NOT NULL DEFAULT 0,
    employee_name VARCHAR(150) NULL,
    employee_id VARCHAR(50) NULL,

    -- Family
    parent_guardian_name VARCHAR(150) NOT NULL,
    parent_guardian_aadhaar VARCHAR(12) NULL,
    parent_guardian_mobile VARCHAR(15) NOT NULL,
    occupation VARCHAR(150) NOT NULL,
    annual_family_income DECIMAL(12,2) NOT NULL,
    ration_card_type VARCHAR(50) NOT NULL,
    ration_card_number VARCHAR(100) NOT NULL,
    previously_applied TINYINT(1) NOT NULL DEFAULT 0,
    previous_application_year YEAR NULL,
    previous_scholarship_name VARCHAR(255) NULL,
    present_address TEXT NOT NULL,

    -- Bank
    bank_account_holder_name VARCHAR(150) NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    branch_name VARCHAR(150) NOT NULL,

    -- Review
    admin_remarks TEXT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    submission_attempt INT UNSIGNED NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_app_program FOREIGN KEY (scholarship_program_id) REFERENCES scholarship_programs(id),
    CONSTRAINT fk_app_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES admins(id),

    INDEX idx_app_status (status),
    INDEX idx_app_program (scholarship_program_id),
    INDEX idx_app_mobile (mobile_number),
    INDEX idx_app_created (created_at)
);

-- ============================================================
-- ACADEMIC DETAILS — dynamic JSON, mirrors scholarshipConfig.js
-- ============================================================

CREATE TABLE scholarship_academic_details (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL UNIQUE,
    academic_data JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_academic_application FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE
);

-- ============================================================
-- DOCUMENTS
--
-- file_path stores the Cloudflare R2 object key, in the form:
--   applications/{scholarshipCode}/{applicationId}/{documentType}{ext}
-- e.g. applications/apj/42/aadhaar.pdf
-- ============================================================

CREATE TABLE scholarship_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_version INT UNSIGNED NOT NULL DEFAULT 1,
    is_current TINYINT(1) NOT NULL DEFAULT 1,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doc_application FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE,
    INDEX idx_doc_application (application_id),
    INDEX idx_doc_type (document_type)
);

-- ============================================================
-- STATUS HISTORY & REVIEWS
-- ============================================================

CREATE TABLE scholarship_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    remarks TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hist_application FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_hist_admin FOREIGN KEY (changed_by) REFERENCES admins(id),
    INDEX idx_hist_application (application_id)
);

CREATE TABLE scholarship_application_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    review_type VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    reason TEXT NULL,
    remarks TEXT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_application FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_admin FOREIGN KEY (reviewed_by) REFERENCES admins(id),
    INDEX idx_review_application (application_id)
);

CREATE TABLE scholarship_disbursements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    application_id BIGINT UNSIGNED NOT NULL,
    approved_amount DECIMAL(12,2) NOT NULL,
    disbursed_amount DECIMAL(12,2) NULL,
    disbursement_date DATE NULL,
    payment_reference VARCHAR(150) NULL,
    payment_mode ENUM('bank_transfer','cheque','upi','other') NULL,
    status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
    remarks TEXT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_disb_application FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_disb_admin FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- ============================================================
-- DYNAMIC CONFIG — status workflow & document requirements
-- ============================================================

CREATE TABLE status_transition_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id INT UNSIGNED NULL,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    required_permission_code VARCHAR(100) NULL,
    system_allowed TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_transition_program FOREIGN KEY (program_id) REFERENCES scholarship_programs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_transition_rule (program_id, from_status, to_status),
    INDEX idx_transition_from (from_status)
);

CREATE TABLE document_type_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id INT UNSIGNED NOT NULL,
    document_code VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_doc_config_program FOREIGN KEY (program_id) REFERENCES scholarship_programs(id) ON DELETE CASCADE,
    UNIQUE KEY uq_program_document_code (program_id, document_code)
);

-- ============================================================
-- CONTACT US
-- ============================================================

CREATE TABLE contact_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    source_page VARCHAR(100) NULL,
    status ENUM('new','read','responded','archived') NOT NULL DEFAULT 'new',
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_contact_status (status),
    INDEX idx_contact_created (created_at)
);

CREATE TABLE contact_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contact_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    remarks TEXT NULL,
    changed_by BIGINT UNSIGNED NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contact_status_message FOREIGN KEY (contact_id) REFERENCES contact_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_contact_status_admin FOREIGN KEY (changed_by) REFERENCES admins(id),
    INDEX idx_contact_status_message (contact_id)
);
