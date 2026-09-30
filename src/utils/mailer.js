// ============================================================
// MAIL UTILITY — Bondada Foundation
//
// Thin wrapper around nodemailer. Used for:
//   1. Contact-form notifications (existing)
//   2. Scholarship application status notifications (NEW)
//   3. Donation receipt emails (NEW)
//
// Required environment variables:
//   SMTP_HOST      e.g. smtp.hostinger.com / smtp.gmail.com
//   SMTP_PORT      e.g. 587 (STARTTLS) or 465 (implicit TLS)
//   SMTP_SECURE    "true" for port 465, "false" for 587
//   SMTP_USER      the mailbox username used to authenticate
//   SMTP_PASSWORD  the mailbox password / app password
//   MAIL_FROM      optional — defaults to SMTP_USER
//   CONTACT_RECEIVER_EMAIL  optional — defaults to info@bondadafoundation.org
//
// If SMTP is not configured, sendMail() logs a warning and
// resolves with { sent: false } — the caller continues normally.
// ============================================================

import nodemailer from "nodemailer";
import env from "../config/env.js";

let transporter = null;
let transporterKey = null;

const buildTransporterKey = () =>
  [env.mail.host, env.mail.port, env.mail.secure, env.mail.user, env.mail.password].join("|");

const getTransporter = () => {
  if (!env.mail.host || !env.mail.user || !env.mail.password) {
    return null;
  }

  const key = buildTransporterKey();

  if (transporter && transporterKey === key) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    requireTLS: !env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.password,
    },
  });

  transporterKey = key;
  return transporter;
};

// ============================================================
// CORE SEND — never throws. Returns { sent: boolean, reason? }
// ============================================================

export const sendMail = async ({ to, subject, text, html, replyTo }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn(
      "[mailer] Email not sent — SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing)."
    );
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    await activeTransporter.sendMail({
      from: env.mail.from,
      to,
      subject,
      text,
      html,
      replyTo,
    });

    return { sent: true };
  } catch (error) {
    console.error("[mailer] Failed to send email:", error);
    return { sent: false, reason: error.message };
  }
};

// ============================================================
// SCHOLARSHIP STATUS NOTIFICATION
//
// Sent to the student when their application is moved to
// "approved" or "rejected" (EMAIL_NOTIFICATION_STATUSES).
// Called from scholarship.workflow.service.js after a successful
// status change — fire-and-forget (not awaited in hot path).
//
// @param {object} opts
//   studentName       string  — applicant's full name
//   studentEmail      string  — applicant's email address
//   applicationNumber string  — e.g. BF-2026-DIPLOMA-0001
//   scholarshipName   string  — e.g. "Bondada Nirmalavathi Scholarship (Diploma Level)"
//   newStatus         string  — "approved" | "rejected"
//   reason            string? — admin-supplied reason (required for rejected)
//   remarks           string? — optional admin remarks
// ============================================================

export const sendScholarshipStatusEmail = async ({
  studentName,
  studentEmail,
  applicationNumber,
  scholarshipName,
  newStatus,
  reason = null,
  remarks = null,
}) => {
  const isApproved = newStatus === "approved";

  const subject = isApproved
    ? `Congratulations! Your Scholarship Application Has Been Approved — ${applicationNumber}`
    : `Update on Your Scholarship Application — ${applicationNumber}`;

  const statusLabel = isApproved ? "Approved ✅" : "Rejected ❌";
  const reasonBlock = reason
    ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : "";
  const remarksBlock = remarks
    ? `<p><strong>Additional Remarks:</strong> ${escapeHtml(remarks)}</p>`
    : "";

  const approvedBody = `
    <p>We are delighted to inform you that your scholarship application has been <strong>approved</strong>.</p>
    <p>The scholarship amount will be disbursed to your registered bank account. Please ensure your bank details are correct. If you have any queries, feel free to contact us.</p>
  `;

  const rejectedBody = `
    <p>Thank you for applying to the Bondada Foundation scholarship programme. After careful review, we regret to inform you that your application has <strong>not been selected</strong> for this cycle.</p>
    ${reasonBlock}
    <p>We encourage you to apply again in the future. If you have any questions, please do not hesitate to contact us.</p>
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a3c6e; color: #ffffff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p  { margin: 6px 0 0; font-size: 13px; opacity: 0.85; }
    .body { padding: 28px 32px; color: #333333; line-height: 1.7; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px;
      font-weight: bold; font-size: 14px; margin-bottom: 18px;
      background: ${isApproved ? "#d4edda" : "#f8d7da"};
      color: ${isApproved ? "#155724" : "#721c24"}; }
    .info-table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    .info-table td { padding: 8px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; }
    .info-table td:first-child { color: #666; width: 45%; }
    .footer { background: #f4f4f4; padding: 16px 32px; font-size: 12px; color: #888; text-align: center; }
    .footer a { color: #1a3c6e; text-decoration: none; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Bondada Foundation</h1>
    <p>Scholarship Application Update</p>
  </div>
  <div class="body">
    <p>Dear <strong>${escapeHtml(studentName)}</strong>,</p>
    <div class="status-badge">${statusLabel}</div>
    ${isApproved ? approvedBody : rejectedBody}
    <table class="info-table">
      <tr><td>Application Number</td><td><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td>Scholarship</td><td>${escapeHtml(scholarshipName)}</td></tr>
      <tr><td>Status</td><td><strong>${statusLabel}</strong></td></tr>
    </table>
    ${remarksBlock}
    <p>If you have any questions, please contact us at
       <a href="mailto:info@bondadafoundation.org">info@bondadafoundation.org</a>.</p>
    <p>Warm regards,<br /><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

  const text = isApproved
    ? `Dear ${studentName},\n\nCongratulations! Your scholarship application (${applicationNumber}) for ${scholarshipName} has been APPROVED.\n\nThe scholarship amount will be disbursed to your registered bank account.\n\nIf you have any queries, please contact info@bondadafoundation.org.\n\nWarm regards,\nBondada Foundation Team`
    : `Dear ${studentName},\n\nThank you for applying for the ${scholarshipName} scholarship. We regret to inform you that your application (${applicationNumber}) has not been selected for this cycle.\n\n${reason ? "Reason: " + reason + "\n\n" : ""}We encourage you to apply again in the future.\n\nIf you have any questions, please contact info@bondadafoundation.org.\n\nWarm regards,\nBondada Foundation Team`;

  return sendMail({ to: studentEmail, subject, html, text });
};

// ============================================================
// DONATION RECEIPT EMAIL
//
// Sent to the donor after a successful Razorpay payment.
// Called from the donations module after payment verification.
//
// @param {object} opts
//   donorName       string  — donor's name
//   donorEmail      string  — donor's email address
//   amount          number  — amount in INR (e.g. 5000)
//   cause           string  — selected cause/category
//   transactionId   string  — Razorpay payment ID
//   paymentDate     string  — formatted date string
//   orderId         string? — Razorpay order ID (optional)
//   mobile          string? — donor's phone number (optional)
// ============================================================

export const sendDonationReceiptEmail = async ({
  donorName,
  donorEmail,
  amount,
  cause,
  transactionId,
  paymentDate,
  orderId = null,
  mobile = null,
}) => {
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

  const subject = `Donation Receipt — ${formattedAmount} received — Bondada Foundation`;

  const orderRow = orderId
    ? `<tr><td>Order ID</td><td>${escapeHtml(orderId)}</td></tr>`
    : "";
  const mobileRow = mobile
    ? `<tr><td>Phone</td><td>${escapeHtml(mobile)}</td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .wrapper { max-width: 620px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a3c6e; color: #ffffff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p  { margin: 6px 0 0; font-size: 13px; opacity: 0.85; }
    .body { padding: 28px 32px; color: #333333; line-height: 1.7; }
    .amount-box { background: #eaf4e8; border-left: 4px solid #2e7d32; padding: 14px 20px;
      border-radius: 4px; margin: 18px 0; }
    .amount-box .amount { font-size: 28px; font-weight: bold; color: #2e7d32; }
    .amount-box .label { font-size: 12px; color: #555; margin-top: 4px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    .info-table td { padding: 8px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; }
    .info-table td:first-child { color: #666; width: 45%; }
    .note { font-size: 12px; color: #888; margin-top: 20px; padding: 12px 16px;
      background: #fafafa; border-radius: 4px; }
    .footer { background: #f4f4f4; padding: 16px 32px; font-size: 12px; color: #888; text-align: center; }
    .footer a { color: #1a3c6e; text-decoration: none; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Bondada Foundation</h1>
    <p>Official Donation Receipt</p>
  </div>
  <div class="body">
    <p>Dear <strong>${escapeHtml(donorName)}</strong>,</p>
    <p>Thank you for your generous contribution to the Bondada Foundation. Your support helps us make a meaningful difference in the lives of students and communities.</p>

    <div class="amount-box">
      <div class="amount">${formattedAmount}</div>
      <div class="label">Donation received successfully</div>
    </div>

    <table class="info-table">
      <tr><td>Donor Name</td><td><strong>${escapeHtml(donorName)}</strong></td></tr>
      ${mobileRow}
      <tr><td>Donation Amount</td><td><strong>${formattedAmount}</strong></td></tr>
      <tr><td>Cause / Category</td><td>${escapeHtml(cause)}</td></tr>
      <tr><td>Transaction ID</td><td><code>${escapeHtml(transactionId)}</code></td></tr>
      ${orderRow}
      <tr><td>Payment Date</td><td>${escapeHtml(paymentDate)}</td></tr>
      <tr><td>Payment Mode</td><td>Online (Razorpay)</td></tr>
      <tr><td>Receipt From</td><td>Bondada Foundation</td></tr>
    </table>

    <div class="note">
      Please keep this email as your donation receipt. This is an automatically generated
      receipt from the Bondada Foundation. For tax-related queries, please contact us at
      <a href="mailto:info@bondadafoundation.org">info@bondadafoundation.org</a>.
    </div>

    <p>With gratitude,<br /><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

  const text = `Dear ${donorName},

Thank you for your generous donation to the Bondada Foundation!

DONATION RECEIPT
----------------
Donor Name      : ${donorName}${mobile ? "\nPhone           : " + mobile : ""}
Donation Amount : ${formattedAmount}
Cause           : ${cause}
Transaction ID  : ${transactionId}${orderId ? "\nOrder ID        : " + orderId : ""}
Payment Date    : ${paymentDate}
Payment Mode    : Online (Razorpay)

Please keep this email as your official donation receipt.

For any queries, please contact info@bondadafoundation.org.

With gratitude,
Bondada Foundation Team`;

  return sendMail({ to: donorEmail, subject, html, text });
};

// ============================================================
// HELPER — minimal HTML escaping to prevent injection in emails
// ============================================================

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default { sendMail, sendScholarshipStatusEmail, sendDonationReceiptEmail };
