-- ============================================================
-- BONDADA FOUNDATION
-- STORED PROCEDURES — CONTACT US MODULE
-- ============================================================

USE bondada_foundation;

DELIMITER $$


DROP PROCEDURE IF EXISTS sp_contact_message_create $$
CREATE PROCEDURE sp_contact_message_create(
    IN p_name VARCHAR(150),
    IN p_email VARCHAR(150),
    IN p_phone VARCHAR(20),
    IN p_subject VARCHAR(255),
    IN p_message TEXT,
    IN p_source_page VARCHAR(100),
    IN p_ip VARCHAR(45)
)
BEGIN
    INSERT INTO contact_messages (name, email, phone, subject, message, source_page, ip_address, status)
    VALUES (p_name, p_email, p_phone, p_subject, p_message, p_source_page, p_ip, 'new');

    SELECT LAST_INSERT_ID() AS contact_id;
END $$


DROP PROCEDURE IF EXISTS sp_contact_message_list $$
CREATE PROCEDURE sp_contact_message_list(
    IN p_status VARCHAR(20),
    IN p_search VARCHAR(150),
    IN p_date_from DATE,
    IN p_date_to DATE,
    IN p_limit INT UNSIGNED,
    IN p_offset INT UNSIGNED
)
BEGIN
    SELECT id, name, email, phone, subject, LEFT(message, 200) AS message_preview,
           status, source_page, created_at, updated_at
    FROM contact_messages
    WHERE (p_status IS NULL OR status = p_status)
      AND (p_search IS NULL OR name LIKE CONCAT('%', p_search, '%')
                             OR email LIKE CONCAT('%', p_search, '%'))
      AND (p_date_from IS NULL OR DATE(created_at) >= p_date_from)
      AND (p_date_to IS NULL OR DATE(created_at) <= p_date_to)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset;

    SELECT COUNT(*) AS total
    FROM contact_messages
    WHERE (p_status IS NULL OR status = p_status)
      AND (p_search IS NULL OR name LIKE CONCAT('%', p_search, '%')
                             OR email LIKE CONCAT('%', p_search, '%'))
      AND (p_date_from IS NULL OR DATE(created_at) >= p_date_from)
      AND (p_date_to IS NULL OR DATE(created_at) <= p_date_to);
END $$


DROP PROCEDURE IF EXISTS sp_contact_message_get $$
CREATE PROCEDURE sp_contact_message_get(
    IN p_id BIGINT UNSIGNED
)
BEGIN
    SELECT * FROM contact_messages WHERE id = p_id LIMIT 1;

    SELECT h.*, a.full_name AS changed_by_name
    FROM contact_status_history h
    LEFT JOIN admins a ON a.id = h.changed_by
    WHERE h.contact_id = p_id
    ORDER BY h.changed_at ASC;
END $$


DROP PROCEDURE IF EXISTS sp_contact_message_update_status $$
CREATE PROCEDURE sp_contact_message_update_status(
    IN p_id BIGINT UNSIGNED,
    IN p_new_status VARCHAR(20),
    IN p_remarks TEXT,
    IN p_changed_by BIGINT UNSIGNED
)
proc_body: BEGIN

    DECLARE v_old_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT status INTO v_old_status FROM contact_messages WHERE id = p_id LIMIT 1;

    IF v_old_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Contact message not found.';
    END IF;

    START TRANSACTION;

    UPDATE contact_messages SET status = p_new_status WHERE id = p_id;

    INSERT INTO contact_status_history (contact_id, old_status, new_status, remarks, changed_by)
    VALUES (p_id, v_old_status, p_new_status, p_remarks, p_changed_by);

    COMMIT;

END $$


DROP PROCEDURE IF EXISTS sp_contact_message_delete $$
CREATE PROCEDURE sp_contact_message_delete(
    IN p_id BIGINT UNSIGNED
)
BEGIN
    DELETE FROM contact_messages WHERE id = p_id;
END $$


DELIMITER ;
