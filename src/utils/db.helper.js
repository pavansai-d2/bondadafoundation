// ============================================================
// STORED PROCEDURE CALL HELPER
//
// Every repository in this project calls the database only
// through this helper. No inline SQL strings belong in any
// repository file — see database/03_*.sql, 04_*.sql, 05_*.sql
// for the procedure definitions.
// ============================================================

import pool from "../config/db.js";

/**
 * Calls a stored procedure and returns its first result set.
 *
 * @param {string} procedureName - e.g. "sp_scholarship_application_get_by_id"
 * @param {Array} params - positional params, in procedure IN-param order
 * @param {object} [connection] - optional existing pool connection
 *   (only needed for multer file-buffer-then-DB flows that want
 *   to reuse a connection; most calls can omit this and use the pool).
 * @returns {Promise<Array>} rows from the first SELECT the procedure returns
 */
export const callProcedure = async (procedureName, params = [], connection = null) => {
  const executor = connection || pool;

  const placeholders = params.map(() => "?").join(", ");

  const [result] = await executor.execute(
    `CALL ${procedureName}(${placeholders})`,
    params
  );

  // mysql2 returns an array of result sets for CALL statements;
  // the last element is always the OkPacket/metadata, so the
  // actual data is everything before it. Most of our procedures
  // return exactly one SELECT, so we return that first set.
  return Array.isArray(result[0]) ? result[0] : result;
};

/**
 * Calls a stored procedure that returns MULTIPLE result sets
 * (e.g. sp_scholarship_application_get_by_id returns application +
 * academic details + documents in one call).
 *
 * @returns {Promise<Array<Array>>} array of result sets, in order
 */
export const callProcedureMultiResult = async (procedureName, params = [], connection = null) => {
  const executor = connection || pool;

  const placeholders = params.map(() => "?").join(", ");

  const [result] = await executor.execute(
    `CALL ${procedureName}(${placeholders})`,
    params
  );

  // Drop the trailing OkPacket metadata entry.
  if (Array.isArray(result) && result.length && !Array.isArray(result[result.length - 1])) {
    return result.slice(0, -1);
  }

  return result;
};

export default { callProcedure, callProcedureMultiResult };
