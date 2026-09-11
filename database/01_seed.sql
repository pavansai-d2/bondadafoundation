USE bondada_foundation;

-- ============================================================
-- ADMIN ROLES (5 accounts will be created against these — see
-- scripts/seed-admins.js)
-- ============================================================

INSERT INTO admin_roles (id, name, code, description) VALUES
    (1, 'Super Admin', 'super_admin', 'Full access to everything, including admin management.'),
    (2, 'Scholarship Admin', 'scholarship_admin', 'Manages scholarship applications end-to-end.'),
    (3, 'Reviewer', 'reviewer', 'Reviews applications and moves them through the workflow.'),
    (4, 'Finance Admin', 'finance_admin', 'Handles approvals and disbursements.'),
    (5, 'Viewer', 'viewer', 'Read-only access.');

-- ============================================================
-- ADMIN PERMISSIONS
-- ============================================================

INSERT INTO admin_permissions (name, code, module, description) VALUES
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

-- super_admin: everything
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 1, id FROM admin_permissions;

-- scholarship_admin: full scholarship + contact + audit view, no admin management
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 2, id FROM admin_permissions WHERE module IN ('scholarship', 'contact') OR code = 'audit.view';

-- reviewer: view + move through review stages, view/download docs
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 3, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'scholarship.review', 'scholarship.eligible',
    'scholarship.not_eligible',
    'scholarship.document_view', 'scholarship.document_download'
);

-- finance_admin: view + approve/reject/disburse
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 4, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'scholarship.approve',
    'scholarship.reject', 'scholarship.disburse',
    'scholarship.document_view', 'scholarship.document_download'
);

-- viewer: read-only
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 5, id FROM admin_permissions WHERE code IN (
    'scholarship.view', 'contact.view', 'scholarship.document_view'
);

-- ============================================================
-- SCHOLARSHIP PROGRAMS — matches scholarshipConfig.js keys exactly
-- ============================================================

INSERT INTO scholarship_programs (id, code, name, subtitle, description) VALUES
    (1, 'dgk-ssc', 'Bondada Nirmalavathi Scholarship', 'SSC Level', 'For students who have completed SSC.'),
    (2, 'dgk-intermediate', 'Bondada Nirmalavathi Scholarship', 'Intermediate Level', 'For students pursuing Intermediate.'),
    (3, 'srk', 'Bondada Nirmalavathi Scholarship', 'Under Graduation Level', 'For undergraduate students.'),
    (4, 'apj', 'Bondada Nirmalavathi Scholarship', 'Post Graduation Level', 'For postgraduate students.'),
    (5, 'vidya-asara', 'Bondada Vidya Asara', 'Complete Education Support', 'Complete educational support and financial assistance.');

-- ============================================================
-- STATUS TRANSITION RULES (global — program_id NULL applies to all)
-- ============================================================

-- ============================================================
-- STATUS TRANSITION RULES (global — program_id NULL applies to all)
--
-- Simplified linear workflow:
-- applied -> under_review -> eligible/not_eligible
-- eligible -> approved -> disbursed
-- not_eligible -> rejected
-- ============================================================

INSERT INTO status_transition_rules
    (program_id, from_status, to_status, required_permission_code, system_allowed, sort_order)
VALUES
    (NULL, 'applied',      'under_review', 'scholarship.review',       0, 10),
    (NULL, 'under_review', 'eligible',     'scholarship.eligible',     0, 20),
    (NULL, 'under_review', 'not_eligible', 'scholarship.not_eligible', 0, 30),
    (NULL, 'eligible',     'approved',     'scholarship.approve',      0, 40),
    (NULL, 'approved',     'disbursed',    'scholarship.disburse',     0, 50),
    (NULL, 'not_eligible', 'rejected',     'scholarship.reject',       0, 60);

-- ============================================================
-- DOCUMENT TYPE CONFIG — 6 documents per program, matches
-- docsDetails.jsx exactly: aadhaar, photo, marks_memo,
-- income_certificate, bank_passbook, ration_card
-- ============================================================

INSERT INTO document_type_config (program_id, document_code, label, is_required, sort_order)
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