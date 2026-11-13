-- ============================================================
-- BONDADA FOUNDATION
-- DONATIONS MODULE (Razorpay Payment Page webhook)
--
-- Run on the LIVE database (select the right DB first / in phpMyAdmin
-- pick the database in the left tree). No "USE" line on purpose,
-- because the live DB name differs from the local one.
--
-- email_sent values:
--   0 = not sent yet / failed (can be retried)
--   1 = thank-you email sent
--   2 = being sent right now (claimed by one webhook delivery)
-- ============================================================

CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  razorpay_event_id VARCHAR(100) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(50) NOT NULL UNIQUE,
  razorpay_order_id VARCHAR(50) NULL,
  donor_name VARCHAR(150) NULL,
  donor_email VARCHAR(190) NULL,
  donor_phone VARCHAR(20) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(5) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'captured',
  email_sent TINYINT(1) DEFAULT 0,
  email_error VARCHAR(255) NULL,
  raw_payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_donation_record_and_claim $$
CREATE PROCEDURE sp_donation_record_and_claim(
    IN p_event_id VARCHAR(100),
    IN p_payment_id VARCHAR(50),
    IN p_order_id VARCHAR(50),
    IN p_donor_name VARCHAR(150),
    IN p_donor_email VARCHAR(190),
    IN p_donor_phone VARCHAR(20),
    IN p_amount DECIMAL(12,2),
    IN p_currency VARCHAR(5),
    IN p_payload LONGTEXT
)
BEGIN
    DECLARE v_inserted INT DEFAULT 0;
    DECLARE v_claimed INT DEFAULT 0;

    -- Duplicate webhook deliveries hit the UNIQUE keys and are ignored.
    INSERT IGNORE INTO donations
        (razorpay_event_id, razorpay_payment_id, razorpay_order_id, donor_name,
         donor_email, donor_phone, amount, currency, raw_payload)
    VALUES
        (p_event_id, p_payment_id, p_order_id, p_donor_name,
         p_donor_email, p_donor_phone, p_amount, p_currency, p_payload);
    SET v_inserted = ROW_COUNT();

    -- Only ONE delivery can flip 0 -> 2, so only one sends the email.
    UPDATE donations
       SET email_sent = 2
     WHERE razorpay_payment_id = p_payment_id
       AND email_sent = 0
       AND donor_email IS NOT NULL
       AND donor_email <> '';
    SET v_claimed = ROW_COUNT();

    SELECT v_inserted AS inserted, v_claimed AS claimed;
END $$

DROP PROCEDURE IF EXISTS sp_donation_email_result $$
CREATE PROCEDURE sp_donation_email_result(
    IN p_payment_id VARCHAR(50),
    IN p_success TINYINT,
    IN p_error VARCHAR(255)
)
BEGIN
    UPDATE donations
       SET email_sent = IF(p_success = 1, 1, 0),
           email_error = IF(p_success = 1, NULL, p_error)
     WHERE razorpay_payment_id = p_payment_id;
END $$

DELIMITER ;
