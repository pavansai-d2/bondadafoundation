// ============================================================
// ONE-OFF: creates the donations table (if missing) and the two
// donation stored procedures on the database the app is connected
// to. Safe to re-run (CREATE IF NOT EXISTS / DROP+CREATE).
//
// Run it where the app's DB env vars are available, e.g. from the
// Render service Shell:   node scripts/add-donation-procedures.js
//
// Alternative: run database/06_donations.sql in phpMyAdmin.
// ============================================================

import pool from "../src/config/db.js";

const statements = [
  `CREATE TABLE IF NOT EXISTS donations (
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
  )`,

  `DROP PROCEDURE IF EXISTS sp_donation_record_and_claim`,
  `CREATE PROCEDURE sp_donation_record_and_claim(
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

      INSERT IGNORE INTO donations
          (razorpay_event_id, razorpay_payment_id, razorpay_order_id, donor_name,
           donor_email, donor_phone, amount, currency, raw_payload)
      VALUES
          (p_event_id, p_payment_id, p_order_id, p_donor_name,
           p_donor_email, p_donor_phone, p_amount, p_currency, p_payload);
      SET v_inserted = ROW_COUNT();

      UPDATE donations
         SET email_sent = 2
       WHERE razorpay_payment_id = p_payment_id
         AND email_sent = 0
         AND donor_email IS NOT NULL
         AND donor_email <> '';
      SET v_claimed = ROW_COUNT();

      SELECT v_inserted AS inserted, v_claimed AS claimed;
  END`,

  `DROP PROCEDURE IF EXISTS sp_donation_email_result`,
  `CREATE PROCEDURE sp_donation_email_result(
      IN p_payment_id VARCHAR(50),
      IN p_success TINYINT,
      IN p_error VARCHAR(255)
  )
  BEGIN
      UPDATE donations
         SET email_sent = IF(p_success = 1, 1, 0),
             email_error = IF(p_success = 1, NULL, p_error)
       WHERE razorpay_payment_id = p_payment_id;
  END`,
];

try {
  for (const sql of statements) {
    await pool.query(sql);
  }
  const [rows] = await pool.query(
    "SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME LIKE 'sp_donation_%'"
  );
  console.log("DONATION DB SETUP COMPLETE. Procedures:", rows.map((r) => r.ROUTINE_NAME));
  process.exit(0);
} catch (err) {
  console.error("DONATION DB SETUP FAILED:", err.message);
  process.exit(1);
}
