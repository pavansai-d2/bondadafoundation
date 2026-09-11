// ============================================================
// ONE-OFF FIX — 2026-09-10
//
// Adds sp_scholarship_application_check_recent, used by the new
// "did my submission actually go through?" check. This lets the
// frontend verify with the server instead of guessing when a
// submission fails at the raw network level (server finishes and
// saves the application, but the browser's fetch() never receives
// a usable response) — the exact behavior seen in your recent
// 201-but-still-shows-error submissions.
//
// Safe to re-run: DROP PROCEDURE IF EXISTS + CREATE PROCEDURE only.
// Touches no data.
//
// HOW TO RUN — same process as run-db-fix-2026-09-09.js:
//   1. Deploy this file to scripts/ in your backend project.
//   2. Temporarily set package.json's "start" to:
//        "node scripts/add-check-procedure-2026-09-10.js"
//   3. Update Preview, check Logs > Preview for "DONE".
//   4. Set "start" back to "node src/server.js".
//   5. Update Preview again, confirm health, then Publish to Live.
// ============================================================

import pool from "../src/config/db.js";

const sql = `
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
END
`;

const run = async () => {
  console.log("=== ADD CHECK PROCEDURE — starting ===");

  const connection = await pool.getConnection();

  try {
    process.stdout.write("- Drop old sp_scholarship_application_check_recent (if any) ... ");
    await connection.query("DROP PROCEDURE IF EXISTS sp_scholarship_application_check_recent");
    console.log("ok");

    process.stdout.write("- Create sp_scholarship_application_check_recent ... ");
    await connection.query(sql);
    console.log("ok");

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.routines
       WHERE ROUTINE_SCHEMA = DATABASE()
         AND ROUTINE_NAME = 'sp_scholarship_application_check_recent'`
    );

    console.log(`Verified present: ${rows[0].cnt > 0 ? "YES" : "NO — something went wrong"}`);
    console.log("=== DONE ===");
    process.exit(0);
  } catch (error) {
    console.error("=== FAILED ===");
    console.error(error);
    process.exit(1);
  } finally {
    connection.release();
  }
};

run();