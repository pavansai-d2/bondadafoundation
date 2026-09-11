-- ============================================================
-- BONDADA FOUNDATION
-- STORED PROCEDURES — ADMIN / AUTH / RBAC MODULE
-- ============================================================

USE bondada_foundation;

DELIMITER $$


DROP PROCEDURE IF EXISTS sp_admin_find_by_email $$
CREATE PROCEDURE sp_admin_find_by_email(
    IN p_email VARCHAR(150)
)
BEGIN
    SELECT a.id, a.role_id, a.full_name, a.email, a.mobile, a.password_hash, a.status,
           a.failed_login_attempts, a.locked_until, a.last_login_at, a.last_login_ip,
           r.name AS role_name, r.code AS role_code
    FROM admins a
    INNER JOIN admin_roles r ON r.id = a.role_id
    WHERE a.email = p_email
    LIMIT 1;
END $$


DROP PROCEDURE IF EXISTS sp_admin_find_by_id $$
CREATE PROCEDURE sp_admin_find_by_id(
    IN p_admin_id BIGINT UNSIGNED
)
BEGIN
    SELECT a.id, a.role_id, a.full_name, a.email, a.mobile, a.status,
           a.last_login_at, a.last_login_ip, a.created_at,
           r.name AS role_name, r.code AS role_code
    FROM admins a
    INNER JOIN admin_roles r ON r.id = a.role_id
    WHERE a.id = p_admin_id
    LIMIT 1;
END $$


DROP PROCEDURE IF EXISTS sp_admin_create $$
CREATE PROCEDURE sp_admin_create(
    IN p_role_id BIGINT UNSIGNED,
    IN p_full_name VARCHAR(150),
    IN p_email VARCHAR(150),
    IN p_mobile VARCHAR(20),
    IN p_password_hash VARCHAR(255)
)
BEGIN
    INSERT INTO admins (role_id, full_name, email, mobile, password_hash, status)
    VALUES (p_role_id, p_full_name, p_email, p_mobile, p_password_hash, 'active');

    SELECT LAST_INSERT_ID() AS admin_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_list $$
CREATE PROCEDURE sp_admin_list(
    IN p_role_id BIGINT UNSIGNED,
    IN p_status VARCHAR(20)
)
BEGIN
    SELECT a.id, a.full_name, a.email, a.mobile, a.status, a.last_login_at,
           a.created_at, r.name AS role_name, r.code AS role_code
    FROM admins a
    INNER JOIN admin_roles r ON r.id = a.role_id
    WHERE (p_role_id IS NULL OR a.role_id = p_role_id)
      AND (p_status IS NULL OR a.status = p_status)
    ORDER BY a.created_at DESC;
END $$


DROP PROCEDURE IF EXISTS sp_admin_update_status $$
CREATE PROCEDURE sp_admin_update_status(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_status VARCHAR(20)
)
BEGIN
    UPDATE admins SET status = p_status WHERE id = p_admin_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_update_password $$
CREATE PROCEDURE sp_admin_update_password(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_password_hash VARCHAR(255)
)
BEGIN
    UPDATE admins SET password_hash = p_password_hash WHERE id = p_admin_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_update_login_success $$
CREATE PROCEDURE sp_admin_update_login_success(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_ip VARCHAR(45)
)
BEGIN
    UPDATE admins
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        last_login_ip = p_ip
    WHERE id = p_admin_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_update_login_failure $$
CREATE PROCEDURE sp_admin_update_login_failure(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_max_attempts INT,
    IN p_lock_minutes INT
)
BEGIN
    UPDATE admins
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = IF(
            failed_login_attempts + 1 >= p_max_attempts,
            DATE_ADD(NOW(), INTERVAL p_lock_minutes MINUTE),
            locked_until
        )
    WHERE id = p_admin_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_permissions_get $$
CREATE PROCEDURE sp_admin_permissions_get(
    IN p_admin_id BIGINT UNSIGNED
)
BEGIN
    SELECT DISTINCT p.id, p.name, p.code, p.module, p.description
    FROM admins a
    INNER JOIN admin_roles r ON r.id = a.role_id
    INNER JOIN admin_role_permissions rp ON rp.role_id = r.id
    INNER JOIN admin_permissions p ON p.id = rp.permission_id
    WHERE a.id = p_admin_id AND r.status = 'active'
    ORDER BY p.module ASC, p.code ASC;
END $$


DROP PROCEDURE IF EXISTS sp_admin_login_log_insert $$
CREATE PROCEDURE sp_admin_login_log_insert(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_email VARCHAR(150),
    IN p_status VARCHAR(20),
    IN p_ip VARCHAR(45),
    IN p_user_agent VARCHAR(500),
    IN p_failure_reason VARCHAR(255)
)
BEGIN
    INSERT INTO admin_login_logs (admin_id, email, status, ip_address, user_agent, failure_reason)
    VALUES (p_admin_id, p_email, p_status, p_ip, p_user_agent, p_failure_reason);
END $$


DROP PROCEDURE IF EXISTS sp_admin_refresh_token_insert $$
CREATE PROCEDURE sp_admin_refresh_token_insert(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_token_hash VARCHAR(255),
    IN p_expires_at DATETIME,
    IN p_ip VARCHAR(45),
    IN p_user_agent VARCHAR(500)
)
BEGIN
    INSERT INTO admin_refresh_tokens (admin_id, token_hash, expires_at, ip_address, user_agent)
    VALUES (p_admin_id, p_token_hash, p_expires_at, p_ip, p_user_agent);

    SELECT LAST_INSERT_ID() AS token_id;
END $$


DROP PROCEDURE IF EXISTS sp_admin_refresh_token_validate $$
CREATE PROCEDURE sp_admin_refresh_token_validate(
    IN p_token_hash VARCHAR(255)
)
BEGIN
    SELECT rt.id, rt.admin_id, rt.expires_at, rt.revoked_at, a.status AS admin_status
    FROM admin_refresh_tokens rt
    INNER JOIN admins a ON a.id = rt.admin_id
    WHERE rt.token_hash = p_token_hash
    LIMIT 1;
END $$


DROP PROCEDURE IF EXISTS sp_admin_refresh_token_revoke $$
CREATE PROCEDURE sp_admin_refresh_token_revoke(
    IN p_token_hash VARCHAR(255)
)
BEGIN
    UPDATE admin_refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = p_token_hash AND revoked_at IS NULL;
END $$


DROP PROCEDURE IF EXISTS sp_admin_refresh_token_revoke_all $$
CREATE PROCEDURE sp_admin_refresh_token_revoke_all(
    IN p_admin_id BIGINT UNSIGNED
)
BEGIN
    UPDATE admin_refresh_tokens
    SET revoked_at = NOW()
    WHERE admin_id = p_admin_id AND revoked_at IS NULL;
END $$


DROP PROCEDURE IF EXISTS sp_admin_audit_log_insert $$
CREATE PROCEDURE sp_admin_audit_log_insert(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_module VARCHAR(100),
    IN p_action VARCHAR(100),
    IN p_entity_type VARCHAR(100),
    IN p_entity_id BIGINT UNSIGNED,
    IN p_old_data JSON,
    IN p_new_data JSON,
    IN p_ip VARCHAR(45),
    IN p_user_agent VARCHAR(500)
)
BEGIN
    INSERT INTO admin_audit_logs (
        admin_id, module, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent
    ) VALUES (
        p_admin_id, p_module, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, p_ip, p_user_agent
    );
END $$


DROP PROCEDURE IF EXISTS sp_admin_audit_log_list $$
CREATE PROCEDURE sp_admin_audit_log_list(
    IN p_admin_id BIGINT UNSIGNED,
    IN p_module VARCHAR(100),
    IN p_page INT UNSIGNED,
    IN p_page_size INT UNSIGNED
)
BEGIN
    DECLARE v_offset INT UNSIGNED;
    SET v_offset = GREATEST(p_page - 1, 0) * p_page_size;

    SELECT l.*, a.full_name AS admin_name
    FROM admin_audit_logs l
    LEFT JOIN admins a ON a.id = l.admin_id
    WHERE (p_admin_id IS NULL OR l.admin_id = p_admin_id)
      AND (p_module IS NULL OR l.module = p_module)
    ORDER BY l.created_at DESC
    LIMIT p_page_size OFFSET v_offset;
END $$


DROP PROCEDURE IF EXISTS sp_admin_roles_list $$
CREATE PROCEDURE sp_admin_roles_list()
BEGIN
    SELECT id, name, code, description, status FROM admin_roles WHERE status = 'active' ORDER BY name;
END $$


DROP PROCEDURE IF EXISTS sp_admin_permissions_list_all $$
CREATE PROCEDURE sp_admin_permissions_list_all()
BEGIN
    SELECT id, name, code, module, description FROM admin_permissions ORDER BY module, code;
END $$


DELIMITER ;
