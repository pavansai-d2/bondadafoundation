// ============================================================
// DONATION RECEIPT CONTROLLER
// POST /api/donations/receipt
//
// Called by the frontend after a donor completes payment via the
// Razorpay.me link and fills in their details, OR by a Razorpay
// webhook (see note below).
//
// Current donation flow (Razorpay.me):
//   1. User picks amount + cause on the Donations page
//   2. User fills the donor-details form
//   3. User is redirected to pages.razorpay.com/bondadafoundation
//   4. User completes payment (Razorpay sends its own confirmation)
//   5. Frontend calls POST /api/donations/receipt with donor data
//      + the Razorpay payment/order IDs the user sees on receipt
//   6. Backend sends the Bondada Foundation branded receipt email
//
// FUTURE: If Razorpay Order API is integrated, replace step 5
// with a Razorpay webhook (payment.captured event) that calls
// sendDonationReceiptEmail() directly.
// ============================================================

import { sendDonationReceiptEmail } from "../../utils/mailer.js";

/**
 * POST /api/donations/receipt
 *
 * Body (JSON):
 *   donorName      string  required
 *   donorEmail     string  required
 *   amount         number  required  (INR, e.g. 5000)
 *   cause          string  required  (e.g. "Education")
 *   transactionId  string  required  (Razorpay payment ID / reference)
 *   paymentDate    string  required  (human-readable, e.g. "30 Sep 2026, 3:45 PM")
 *   orderId        string  optional
 *   mobile         string  optional
 */
export const sendDonationReceipt = async (req, res, next) => {
  try {
    const {
      donorName,
      donorEmail,
      amount,
      cause,
      transactionId,
      paymentDate,
      orderId,
      mobile,
    } = req.body;

    // ── Basic validation ────────────────────────────────────
    const errors = [];

    if (!donorName?.trim())           errors.push("donorName is required.");
    if (!donorEmail?.trim())          errors.push("donorEmail is required.");
    if (!/\S+@\S+\.\S+/.test(String(donorEmail || "")))
                                      errors.push("A valid donorEmail is required.");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
                                      errors.push("A valid amount (> 0) is required.");
    if (!cause?.trim())               errors.push("cause is required.");
    if (!transactionId?.trim())       errors.push("transactionId is required.");
    if (!paymentDate?.trim())         errors.push("paymentDate is required.");

    if (errors.length) {
      return res.status(422).json({ success: false, errors });
    }

    // ── Send receipt (fire-and-forget in the sense that a mail
    //    failure returns a warning, not a 500) ───────────────
    const result = await sendDonationReceiptEmail({
      donorName: donorName.trim(),
      donorEmail: donorEmail.trim(),
      amount: Number(amount),
      cause: cause.trim(),
      transactionId: transactionId.trim(),
      paymentDate: paymentDate.trim(),
      orderId: orderId?.trim() || null,
      mobile: mobile?.trim() || null,
    });

    if (!result.sent) {
      console.warn("[donation-receipt] Receipt email not sent:", result.reason);
      // Still return 200 — the donation is real even if the mail
      // infrastructure has a hiccup. The admin is alerted via the
      // server log.
      return res.status(200).json({
        success: true,
        emailSent: false,
        message: "Donation recorded but receipt email could not be delivered. Our team has been notified.",
      });
    }

    return res.status(200).json({
      success: true,
      emailSent: true,
      message: "Donation receipt email sent successfully.",
    });
  } catch (error) {
    next(error);
  }
};
