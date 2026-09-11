USE bondada_foundation;
USE bondada_foundation;

DELIMITER $$

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

DELIMITER ;