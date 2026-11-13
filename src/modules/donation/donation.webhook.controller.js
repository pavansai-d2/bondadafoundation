// ============================================================
// RAZORPAY WEBHOOK  →  POST /api/v1/webhooks/razorpay
//
// Flow: verify signature → keep only captured donations → save in DB
//       (duplicates ignored) → reply 200 → send thank-you email.
//
// Env (set in Render → Environment):
//   RAZORPAY_WEBHOOK_SECRET   required - the secret typed in the
//                             Razorpay dashboard webhook form
//   RAZORPAY_DONATION_PAGE_ID optional - e.g. pl_XXXXXXXX. If set, only
//                             payments whose payload mentions this id are
//                             treated as donations (see README note).
// ============================================================

import crypto from "crypto";
import { sendDonationThankYouEmail } from "../../utils/mailer.js";
import { recordDonationAndClaimEmail, saveEmailResult } from "./donation.repository.js";

const verifySignature = (rawBody, signature, secret) => {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// The donor name is a custom field on the Razorpay Payment Page, so the
// key depends on the field label. Accept any note key containing "name".
const extractDonorName = (notes) => {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return null;
  for (const [key, value] of Object.entries(notes)) {
    if (/name/i.test(key) && typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 150);
    }
  }
  return null;
};

export const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set.");
    return res.status(500).send("Webhook not configured");
  }

  const rawBody = req.body; // Buffer (express.raw)
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).send("Invalid body");
  }

  if (!verifySignature(rawBody, req.headers["x-razorpay-signature"], secret)) {
    console.warn("[razorpay-webhook] Invalid signature - rejected.");
    return res.status(400).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  // Only successful money-received events.
  if (event.event !== "payment.captured") {
    return res.status(200).send("ignored");
  }

  const payment = event?.payload?.payment?.entity;
  if (!payment?.id) {
    return res.status(200).send("ignored");
  }

  // Optional: only treat payments from the donation Payment Page as donations.
  const pageId = process.env.RAZORPAY_DONATION_PAGE_ID;
  if (pageId && !rawBody.toString("utf8").includes(pageId)) {
    console.log(`[razorpay-webhook] ${payment.id} is not from the donation page - ignored.`);
    return res.status(200).send("ignored");
  }

  const notes = payment.notes || {};
  const donorName = extractDonorName(notes);
  const donorEmail = payment.email ? String(payment.email).trim() : null;
  const amount = Number(payment.amount) / 100; // Razorpay sends paise

  // Log the shape (keys only, no personal data) to help confirm field names.
  console.log("[razorpay-webhook] payment.captured", {
    paymentId: payment.id,
    amount,
    noteKeys: Array.isArray(notes) ? [] : Object.keys(notes),
    hasEmail: Boolean(donorEmail),
    hasName: Boolean(donorName),
  });

  let claimed = 0;
  try {
    const result = await recordDonationAndClaimEmail({
      eventId: req.headers["x-razorpay-event-id"] || `${payment.id}:${event.created_at || ""}`,
      paymentId: payment.id,
      orderId: payment.order_id,
      donorName,
      donorEmail,
      donorPhone: payment.contact ? String(payment.contact).slice(0, 20) : null,
      amount,
      currency: payment.currency,
      payload: rawBody.toString("utf8"),
    });
    claimed = result.claimed;
  } catch (err) {
    // DB problem: reply 500 so Razorpay retries this webhook later.
    console.error("[razorpay-webhook] DB save failed:", err.message);
    return res.status(500).send("error");
  }

  // Donation is safely stored - acknowledge now, email afterwards.
  res.status(200).send("ok");

  if (!claimed) return; // duplicate delivery, already emailed, or no email address

  try {
    const mail = await sendDonationThankYouEmail({
      donorName: donorName || "Donor",
      donorEmail,
      amount,
    });
    await saveEmailResult(payment.id, mail.sent, mail.reason);
  } catch (err) {
    console.error("[razorpay-webhook] Thank-you email failed:", err.message);
    try {
      await saveEmailResult(payment.id, false, err.message);
    } catch (e) {
      console.error("[razorpay-webhook] Could not store email result:", e.message);
    }
  }
};
