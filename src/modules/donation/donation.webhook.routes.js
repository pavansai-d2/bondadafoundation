// Mounted in app.js at /api/v1/webhooks BEFORE express.json(), because
// the signature check needs the exact raw request bytes.

import express from "express";
import pool from "../../config/db.js";
import { handleRazorpayWebhook } from "./donation.webhook.controller.js";

const router = express.Router();

router.post("/razorpay", express.raw({ type: "*/*", limit: "1mb" }), handleRazorpayWebhook);

// GET /api/v1/webhooks/status
// Setup checklist for the donation email feature. Returns only
// true/false flags and counts - never secrets or donor details.
router.get("/status", async (req, res) => {
  const status = {
    webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    donationMailFrom:
      process.env.DONATION_MAIL_FROM || "Bondada Foundation <info@bondadafoundation.org>",
    donationPageFilterActive: Boolean(process.env.RAZORPAY_DONATION_PAGE_ID),
    donationsTableExists: false,
    proceduresInstalled: false,
    donationsStored: null,
    emailsSent: null,
    emailsFailedOrPending: null,
  };

  try {
    const [procs] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME IN ('sp_donation_record_and_claim','sp_donation_email_result')"
    );
    status.proceduresInstalled = Number(procs[0].n) === 2;

    const [tbl] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'donations'"
    );
    status.donationsTableExists = Number(tbl[0].n) === 1;

    if (status.donationsTableExists) {
      const [c] = await pool.query(
        "SELECT COUNT(*) AS total, SUM(email_sent = 1) AS sent, SUM(email_sent <> 1) AS not_sent FROM donations"
      );
      status.donationsStored = Number(c[0].total || 0);
      status.emailsSent = Number(c[0].sent || 0);
      status.emailsFailedOrPending = Number(c[0].not_sent || 0);
    }
  } catch (err) {
    status.dbError = err.message;
  }

  res.status(200).json(status);
});

export default router;
