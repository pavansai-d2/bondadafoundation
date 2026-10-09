// ============================================================
// MAIL UTILITY — Bondada Foundation
// Using Resend API (https://resend.com) — works on Render free
// tier because it uses HTTPS (port 443), not SMTP.
//
// Render blocks all SMTP ports (465, 587) on free plans.
// Resend sends via HTTP API — no SMTP ports needed.
//
// SETUP (one time — 5 minutes):
//   1. Go to resend.com → Sign up free
//   2. Dashboard → API Keys → Create API Key → copy it
//   3. On Render → Environment → add:
//        RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxx
//   4. That's it — no other SMTP vars needed for sending
//
// Free plan: 3,000 emails/month, 100/day — more than enough
//
// NOTE: Resend requires a verified domain OR you can send
// from onboarding@resend.dev while testing. To send from
// bondadafoundationofficial@gmail.com you need to either:
//   Option A: Add Gmail as a custom domain (not possible with Gmail)
//   Option B: Use a domain you own e.g. bondadafoundation.org
//             → verify it on Resend → send from
//             noreply@bondadafoundation.org
//   Option C: During testing use onboarding@resend.dev as FROM
//             (recipient still gets the email, just from that address)
//
// RECOMMENDED: Use noreply@bondadafoundation.org as MAIL_FROM
// since you already own bondadafoundation.org domain.
// Verify it on Resend dashboard → Domains → Add Domain.
// ============================================================

import env from "../config/env.js";

// ============================================================
// CORE SEND via Resend HTTP API
// No nodemailer needed — pure fetch call to Resend's API
// ============================================================

export const sendMail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[mailer] ❌ RESEND_API_KEY not set on Render environment.");
    return { sent: false, reason: "resend_api_key_missing" };
  }

  const fromAddress = env.mail.from ||
    "Bondada Foundation <noreply@bondadafoundation.org>";

  try {
    console.log(`[mailer] Sending via Resend → ${to} | "${subject}"`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[mailer] ❌ Resend API error → ${to}`, {
        status: response.status,
        error: data,
      });
      return { sent: false, reason: data?.message || `HTTP ${response.status}` };
    }

    console.log(`[mailer] ✅ Sent via Resend → ${to} | id: ${data.id}`);
    return { sent: true, messageId: data.id };

  } catch (err) {
    console.error(`[mailer] ❌ Failed → ${to}`, { message: err.message });
    return { sent: false, reason: err.message };
  }
};

// ============================================================
// SCHOLARSHIP STATUS EMAIL
// Triggered on: "approved" and "not_eligible"
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
  const isApproved    = newStatus === "approved";
  const isNotEligible = newStatus === "not_eligible";

  let subject, statusLabel, statusBg, statusColor, bodyContent;

  if (isApproved) {
    subject     = `Congratulations! Your Scholarship Has Been Approved — ${applicationNumber}`;
    statusLabel = "Approved ✅";
    statusBg    = "#d4edda";
    statusColor = "#155724";
    bodyContent = `
      <p>We are delighted to inform you that your scholarship application has been <strong>approved</strong>.</p>
      <p>The scholarship amount will be disbursed to your registered bank account. Please ensure your bank details are correct.</p>
      <p>If you have any queries, feel free to contact us.</p>`;
  } else if (isNotEligible) {
    subject     = `Update on Your Scholarship Application — ${applicationNumber}`;
    statusLabel = "Not Eligible ❌";
    statusBg    = "#f8d7da";
    statusColor = "#721c24";
    bodyContent = `
      <p>Thank you for applying to the Bondada Foundation scholarship programme.</p>
      <p>After careful review, we regret to inform you that your application has been marked as <strong>not eligible</strong> for this cycle.</p>
      ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
      <p>We encourage you to reapply in the future. If you have any questions, please contact us.</p>`;
  } else {
    subject     = `Update on Your Scholarship Application — ${applicationNumber}`;
    statusLabel = newStatus;
    statusBg    = "#e2e3e5";
    statusColor = "#383d41";
    bodyContent = `<p>Your application status has been updated to <strong>${escapeHtml(newStatus)}</strong>.</p>`;
  }

  const remarksBlock = remarks
    ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>`
    : "";

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
    <p>For queries:
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
    ? `Dear ${studentName},\n\nCongratulations! Your application (${applicationNumber}) for ${scholarshipName} has been APPROVED.\n\nThe amount will be disbursed to your bank account.\n\nQueries: bondadafoundationofficial@gmail.com\n\nBondada Foundation Team`
    : `Dear ${studentName},\n\nYour application (${applicationNumber}) for ${scholarshipName} has been marked as NOT ELIGIBLE.\n\n${reason ? "Reason: " + reason + "\n\n" : ""}We encourage you to reapply.\n\nQueries: bondadafoundationofficial@gmail.com\n\nBondada Foundation Team`;

  return sendMail({ to: studentEmail, subject, html, text });
};

// ============================================================
// DONATION RECEIPT EMAIL
// ============================================================

export const sendDonationReceiptEmail = async ({
  donorName, donorEmail, amount, cause, transactionId,
  paymentDate, orderId = null, mobile = null,
}) => {
  const fmt = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount);

  const subject = `Donation Receipt — ${fmt} — Bondada Foundation`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${subject}</title>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;}
  .wrap{max-width:620px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;}
  .hdr{background:#1a3c6e;color:#fff;padding:28px 32px;}
  .hdr h1{margin:0;font-size:22px;}
  .bdy{padding:28px 32px;color:#333;line-height:1.7;}
  .amt{font-size:28px;font-weight:bold;color:#2e7d32;background:#eaf4e8;border-left:4px solid #2e7d32;padding:14px 20px;border-radius:4px;margin:18px 0;}
  table{width:100%;border-collapse:collapse;margin:18px 0;}
  td{padding:8px 0;border-bottom:1px solid #eee;font-size:14px;}
  td:first-child{color:#666;width:45%;}
  .ftr{background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><h1>Bondada Foundation</h1><p>Official Donation Receipt</p></div>
  <div class="bdy">
    <p>Dear <strong>${escapeHtml(donorName)}</strong>,</p>
    <p>Thank you for your generous contribution.</p>
    <div class="amt">${fmt}</div>
    <table>
      <tr><td>Donor Name</td><td>${escapeHtml(donorName)}</td></tr>
      ${mobile ? `<tr><td>Phone</td><td>${escapeHtml(mobile)}</td></tr>` : ""}
      <tr><td>Amount</td><td><strong>${fmt}</strong></td></tr>
      <tr><td>Cause</td><td>${escapeHtml(cause)}</td></tr>
      <tr><td>Transaction ID</td><td>${escapeHtml(transactionId)}</td></tr>
      ${orderId ? `<tr><td>Order ID</td><td>${escapeHtml(orderId)}</td></tr>` : ""}
      <tr><td>Payment Date</td><td>${escapeHtml(paymentDate)}</td></tr>
      <tr><td>Mode</td><td>Online (Razorpay)</td></tr>
    </table>
    <p>With gratitude,<br/><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="ftr">&copy; ${new Date().getFullYear()} Bondada Foundation</div>
</div>
</body></html>`;

  return sendMail({
    to: donorEmail, subject, html,
    text: `Dear ${donorName},\nDonation of ${fmt} received.\nCause: ${cause}\nTxn: ${transactionId}\nDate: ${paymentDate}\n\nBondada Foundation`,
  });
};

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default { sendMail, sendScholarshipStatusEmail, sendDonationReceiptEmail };