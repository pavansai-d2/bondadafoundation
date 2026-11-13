// ============================================================
// DONATION REPOSITORY — stored procedures only (project rule)
// ============================================================

import { callProcedure } from "../../utils/db.helper.js";

/**
 * Saves a captured donation (duplicates ignored) and tries to claim
 * the right to send the thank-you email.
 * @returns {Promise<{inserted:number, claimed:number}>}
 */
export const recordDonationAndClaimEmail = async ({
  eventId,
  paymentId,
  orderId,
  donorName,
  donorEmail,
  donorPhone,
  amount,
  currency,
  payload,
}) => {
  const rows = await callProcedure("sp_donation_record_and_claim", [
    eventId,
    paymentId,
    orderId ?? null,
    donorName ?? null,
    donorEmail ?? null,
    donorPhone ?? null,
    amount,
    currency || "INR",
    payload,
  ]);

  const row = rows?.[0] || {};
  return { inserted: Number(row.inserted || 0), claimed: Number(row.claimed || 0) };
};

export const saveEmailResult = async (paymentId, success, errorMessage = null) => {
  await callProcedure("sp_donation_email_result", [
    paymentId,
    success ? 1 : 0,
    success ? null : String(errorMessage || "unknown error").slice(0, 250),
  ]);
};
