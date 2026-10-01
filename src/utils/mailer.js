// ============================================================
// MAIL UTILITY — Bondada Foundation
//
// Sending from: bondadafoundationofficial@gmail.com (Gmail)
//
// Gmail SMTP requires an App Password (NOT the normal Gmail
// login password). Steps to generate one:
//   1. Go to myaccount.google.com
//   2. Security → 2-Step Verification → turn ON
//   3. Security → App Passwords
//   4. Select app: Mail, Select device: Other → type "Bondada"
//   5. Copy the 16-character password (e.g. abcd efgh ijkl mnop)
//   6. Paste it as SMTP_PASSWORD in .env (no spaces needed)
//
// .env settings to use:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_SECURE=true
//   SMTP_USER=bondadafoundationofficial@gmail.com
//   SMTP_PASSWORD=your-16-char-app-password
//   MAIL_FROM=Bondada Foundation <bondadafoundationofficial@gmail.com>
//   CONTACT_RECEIVER_EMAIL=bondadafoundationofficial@gmail.com
// ============================================================

import nodemailer from "nodemailer";
import env from "../config/env.js";

let transporter = null;
let transporterKey = null;

const buildTransporterKey = () =>
  [env.mail.host, env.mail.port, env.mail.secure, env.mail.user, env.mail.password].join("|");

const getTransporter = () => {
  if (!env.mail.host || !env.mail.user || !env.mail.password) {
    console.warn("[mailer] SMTP not configured — SMTP_HOST, SMTP_USER or SMTP_PASSWORD missing.");
    return null;
  }

  const key = buildTransporterKey();
  if (transporter && transporterKey === key) {
    return transporter;
  }

  // Gmail: port 465 with secure:true (SSL) — no STARTTLS needed
  transporter = nodemailer.createTransport({
    host: env.mail.host,       // smtp.gmail.com
    port: env.mail.port,       // 465
    secure: env.mail.secure,   // true for port 465
    auth: {
      user: env.mail.user,     // bondadafoundationofficial@gmail.com
      pass: env.mail.password, // 16-char App Password
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    console.log(`[mailer] Sending email → To: ${to} | Subject: "${subject}"`);

    const info = await activeTransporter.sendMail({
      from: env.mail.from,
      to,
      subject,
      text,
      html,
      replyTo,
    });

    console.log(`[mailer] ✅ Email sent → ${to} | MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };

  } catch (error) {
    console.error(`[mailer] ❌ Failed to send email → ${to}`, {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
    });
    // Reset transporter so next attempt creates a fresh connection
    transporter = null;
    transporterKey = null;
    return { sent: false, reason: error.message };
  }
};

// ============================================================
// SCHOLARSHIP STATUS NOTIFICATION
//
// Sent to the student when their application status changes to
// "approved" or "rejected".
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

  const statusLabel   = isApproved ? "Approved ✅" : "Rejected ❌";
  const statusBg      = isApproved ? "#d4edda" : "#f8d7da";
  const statusColor   = isApproved ? "#155724" : "#721c24";
  const reasonBlock   = reason  ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`  : "";
  const remarksBlock  = remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : "";

  const bodyContent = isApproved
    ? `<p>We are delighted to inform you that your scholarship application has been <strong>approved</strong>.</p>
       <p>The scholarship amount will be disbursed to your registered bank account. Please ensure your bank details are correct. If you have any queries, feel free to contact us.</p>`
    : `<p>Thank you for applying to the Bondada Foundation scholarship programme. After careful review, we regret to inform you that your application has <strong>not been selected</strong> for this cycle.</p>
       ${reasonBlock}
       <p>We encourage you to apply again in the future. If you have any questions, please do not hesitate to contact us.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;}
    .wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .hdr{background:#1a3c6e;color:#fff;padding:28px 32px;}
    .hdr h1{margin:0;font-size:22px;}
    .hdr p{margin:6px 0 0;font-size:13px;opacity:.85;}
    .bdy{padding:28px 32px;color:#333;line-height:1.7;}
    .badge{display:inline-block;padding:6px 18px;border-radius:20px;font-weight:bold;font-size:14px;margin-bottom:18px;background:${statusBg};color:${statusColor};}
    table{width:100%;border-collapse:collapse;margin:18px 0;}
    td{padding:8px 0;border-bottom:1px solid #eee;font-size:14px;}
    td:first-child{color:#666;width:45%;}
    .ftr{background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center;}
    .ftr a{color:#1a3c6e;text-decoration:none;}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>Bondada Foundation</h1>
    <p>Scholarship Application Update</p>
  </div>
  <div class="bdy">
    <p>Dear <strong>${escapeHtml(studentName)}</strong>,</p>
    <div class="badge">${statusLabel}</div>
    ${bodyContent}
    <table>
      <tr><td>Application Number</td><td><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td>Scholarship</td><td>${escapeHtml(scholarshipName)}</td></tr>
      <tr><td>Status</td><td><strong>${statusLabel}</strong></td></tr>
    </table>
    ${remarksBlock}
    <p>For any questions, contact us at
      <a href="mailto:bondadafoundationofficial@gmail.com">bondadafoundationofficial@gmail.com</a>
    </p>
    <p>Warm regards,<br/><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="ftr">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

  const text = isApproved
    ? `Dear ${studentName},

Congratulations! Your scholarship application (${applicationNumber}) for ${scholarshipName} has been APPROVED.

The scholarship amount will be disbursed to your registered bank account.

For queries: bondadafoundationofficial@gmail.com

Warm regards,
Bondada Foundation Team`
    : `Dear ${studentName},

Thank you for applying for the ${scholarshipName} scholarship.

We regret to inform you that your application (${applicationNumber}) has not been selected for this cycle.
${reason ? "\nReason: " + reason : ""}

We encourage you to apply again in the future.
For queries: bondadafoundationofficial@gmail.com

Warm regards,
Bondada Foundation Team`;

  return sendMail({ to: studentEmail, subject, html, text });
};

// ============================================================
// DONATION RECEIPT EMAIL
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

  const subject = `Donation Receipt — ${formattedAmount} — Bondada Foundation`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;}
    .wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);}
    .hdr{background:#1a3c6e;color:#fff;padding:28px 32px;}
    .hdr h1{margin:0;font-size:22px;}
    .hdr p{margin:6px 0 0;font-size:13px;opacity:.85;}
    .bdy{padding:28px 32px;color:#333;line-height:1.7;}
    .amt-box{background:#eaf4e8;border-left:4px solid #2e7d32;padding:14px 20px;border-radius:4px;margin:18px 0;}
    .amt-box .amt{font-size:28px;font-weight:bold;color:#2e7d32;}
    .amt-box .lbl{font-size:12px;color:#555;margin-top:4px;}
    table{width:100%;border-collapse:collapse;margin:18px 0;}
    td{padding:8px 0;border-bottom:1px solid #eee;font-size:14px;}
    td:first-child{color:#666;width:45%;}
    .note{font-size:12px;color:#888;margin-top:20px;padding:12px 16px;background:#fafafa;border-radius:4px;}
    .ftr{background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center;}
    .ftr a{color:#1a3c6e;text-decoration:none;}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>Bondada Foundation</h1>
    <p>Official Donation Receipt</p>
  </div>
  <div class="bdy">
    <p>Dear <strong>${escapeHtml(donorName)}</strong>,</p>
    <p>Thank you for your generous contribution to the Bondada Foundation. Your support makes a meaningful difference.</p>
    <div class="amt-box">
      <div class="amt">${formattedAmount}</div>
      <div class="lbl">Donation received successfully</div>
    </div>
    <table>
      <tr><td>Donor Name</td><td><strong>${escapeHtml(donorName)}</strong></td></tr>
      ${mobile ? `<tr><td>Phone</td><td>${escapeHtml(mobile)}</td></tr>` : ""}
      <tr><td>Donation Amount</td><td><strong>${formattedAmount}</strong></td></tr>
      <tr><td>Cause</td><td>${escapeHtml(cause)}</td></tr>
      <tr><td>Transaction ID</td><td><code>${escapeHtml(transactionId)}</code></td></tr>
      ${orderId ? `<tr><td>Order ID</td><td>${escapeHtml(orderId)}</td></tr>` : ""}
      <tr><td>Payment Date</td><td>${escapeHtml(paymentDate)}</td></tr>
      <tr><td>Payment Mode</td><td>Online (Razorpay)</td></tr>
    </table>
    <div class="note">
      Please keep this email as your official donation receipt.
      For queries: <a href="mailto:bondadafoundationofficial@gmail.com">bondadafoundationofficial@gmail.com</a>
    </div>
    <p>With gratitude,<br/><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="ftr">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

  const text = `Dear ${donorName},\n\nThank you for your donation!\n\nAmount: ${formattedAmount}\nCause: ${cause}\nTransaction ID: ${transactionId}\nPayment Date: ${paymentDate}\n\nBondada Foundation Team`;

  return sendMail({ to: donorEmail, subject, html, text });
};

// ============================================================
// HELPER — HTML escape
// ============================================================

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default { sendMail, sendScholarshipStatusEmail, sendDonationReceiptEmail };