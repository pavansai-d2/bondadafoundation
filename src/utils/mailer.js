// ============================================================
// MAIL UTILITY — Bondada Foundation
// Using Resend API (https://resend.com) — works on Render free
// tier because it uses HTTPS (port 443), not SMTP.
//
// Render blocks all SMTP ports (465, 587) on free plans.
// Resend sends via HTTP API — no SMTP ports needed.
//
// Render env vars required:
//   RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxx
//   MAIL_FROM      = Bondada Foundation <noreply@bondadafoundation.org>
// ============================================================

import env from "../config/env.js";

// ============================================================
// CORE SEND via Resend HTTP API
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
// Triggered on: "approved" and "rejected"
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
  const isRejected = newStatus === "rejected";

  let subject, htmlBody, textBody;

  if (isApproved) {

    subject = `Congratulations! Your Application Has Been Selected – Bondada Nirmalavathi Scholarship 2026`;

    htmlBody = `<!DOCTYPE html>
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
  .bdy{padding:28px 32px;color:#333;line-height:1.8;font-size:15px;}
  .status-box{background:#d4edda;border-left:4px solid #28a745;padding:14px 20px;border-radius:4px;margin:20px 0;color:#155724;font-weight:bold;}
  .event-box{background:#f0f4ff;border:1px solid #c3cff7;border-radius:6px;padding:20px 24px;margin:20px 0;}
  .event-box h3{margin:0 0 12px 0;color:#1a3c6e;font-size:16px;}
  .event-box table{width:100%;border-collapse:collapse;}
  .event-box td{padding:6px 0;font-size:14px;border:none;}
  .event-box td:first-child{color:#555;width:80px;font-weight:bold;}
  .highlight{color:#1a3c6e;font-weight:bold;}
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
    <p>Greetings from Bondada Foundation!</p>
    <p>Thank you for applying to the <strong>Bondada Nirmalavathi Scholarship 2026 Program</strong>.</p>
    <p>After careful review and evaluation, we are delighted to inform you that <strong>your application has been approved, and you have been selected for the Bondada Nirmalavathi Scholarship 2026.</strong></p>

    <div class="status-box">
      ✅ Application Status: Selected – Meets the Eligibility Criteria
    </div>

    <p>Congratulations on your selection!</p>
    <p>We are pleased to invite you to attend the <strong>Bondada Nirmalavathi Scholarship Distribution Ceremony 2026</strong> and receive your scholarship.</p>

    <div class="event-box">
      <h3>🎓 Event Details</h3>
      <table>
        <tr><td>Date</td><td><span class="highlight">Sunday, 25 October 2026</span></td></tr>
        <tr><td>Time</td><td><span class="highlight">9:30 AM onwards</span></td></tr>
        <tr><td>Venue</td><td><span class="highlight">Gandhi Kshetram, Avanigadda, Krishna District, Andhra Pradesh</span></td></tr>
      </table>
    </div>

    <p>Please arrive at the venue on time to receive your scholarship.</p>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;border:1px solid #eee;border-radius:4px;">
      <tr style="background:#f8f9fa;"><td style="padding:10px 14px;color:#666;width:45%;border-bottom:1px solid #eee;">Application Number</td><td style="padding:10px 14px;border-bottom:1px solid #eee;"><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #eee;">Scholarship</td><td style="padding:10px 14px;border-bottom:1px solid #eee;">${escapeHtml(scholarshipName)}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:10px 14px;color:#666;">Status</td><td style="padding:10px 14px;color:#155724;font-weight:bold;">Selected ✅</td></tr>
    </table>

    ${remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : ""}

    <p>We sincerely appreciate your interest in the program and look forward to celebrating your academic achievements.</p>
    <p>If you have any questions or need clarification, please feel free to contact us at <a href="mailto:bondadafoundationofficial@gmail.com">bondadafoundationofficial@gmail.com</a>.</p>
    <p>Best regards,<br/><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="ftr">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

    textBody = `Dear ${studentName},

Greetings from Bondada Foundation!

Thank you for applying to the Bondada Nirmalavathi Scholarship 2026 Program.

After careful review and evaluation, we are delighted to inform you that your application has been approved, and you have been selected for the Bondada Nirmalavathi Scholarship 2026.

Application Status: Selected – Meets the Eligibility Criteria.

Congratulations on your selection!

We are pleased to invite you to attend the Bondada Nirmalavathi Scholarship Distribution Ceremony 2026 and receive your scholarship.

EVENT DETAILS:
Date   : Sunday, 25 October 2026
Time   : 9:30 AM onwards
Venue  : Gandhi Kshetram, Avanigadda, Krishna District, Andhra Pradesh

Please arrive at the venue on time to receive your scholarship.

Application Number : ${applicationNumber}
Scholarship        : ${scholarshipName}
Status             : Selected ✅

We sincerely appreciate your interest in the program and look forward to celebrating your academic achievements.

If you have any questions or need clarification, please feel free to contact us at bondadafoundationofficial@gmail.com.

Best regards,
Bondada Foundation Team`;

  } else if (isRejected) {

    subject = `Bondada Foundation Scholarship – Application Status`;

    htmlBody = `<!DOCTYPE html>
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
  .bdy{padding:28px 32px;color:#333;line-height:1.8;font-size:15px;}
  .status-box{background:#f8d7da;border-left:4px solid #dc3545;padding:14px 20px;border-radius:4px;margin:20px 0;color:#721c24;font-weight:bold;}
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
    <p>Thank you for applying to the <strong>Bondada Nirmalavathi Scholarship 2026</strong>.</p>
    <p>After careful review, we regret to inform you that your application was not approved for the current scholarship cycle.</p>

    <div class="status-box">
      ❌ ${reason ? escapeHtml(reason) : "Reason: Not Eligible – Application Does Not Meet the Eligibility Criteria."}
    </div>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;border:1px solid #eee;border-radius:4px;">
      <tr style="background:#f8f9fa;"><td style="padding:10px 14px;color:#666;width:45%;border-bottom:1px solid #eee;">Application Number</td><td style="padding:10px 14px;border-bottom:1px solid #eee;"><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #eee;">Scholarship</td><td style="padding:10px 14px;border-bottom:1px solid #eee;">${escapeHtml(scholarshipName)}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:10px 14px;color:#666;">Status</td><td style="padding:10px 14px;color:#721c24;font-weight:bold;">Not Approved ❌</td></tr>
    </table>

    ${remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : ""}

    <p>We appreciate your interest in the scholarship program and encourage you to apply for future opportunities, provided you meet the eligibility criteria.</p>
    <p>If you have any questions or need clarification, please feel free to contact us at <a href="mailto:bondadafoundationofficial@gmail.com">bondadafoundationofficial@gmail.com</a>.</p>
    <p>Best regards,<br/><strong>Bondada Foundation Team</strong></p>
  </div>
  <div class="ftr">
    &copy; ${new Date().getFullYear()} Bondada Foundation &nbsp;|&nbsp;
    <a href="https://bondadafoundation.org">bondadafoundation.org</a>
  </div>
</div>
</body>
</html>`;

    textBody = `Dear ${studentName},

Thank you for applying to the Bondada Nirmalavathi Scholarship 2026.

After careful review, we regret to inform you that your application was not approved for the current scholarship cycle.

${reason ? reason : "Reason: Not Eligible – Application Does Not Meet the Eligibility Criteria."}

Application Number : ${applicationNumber}
Scholarship        : ${scholarshipName}
Status             : Not Approved ❌

We appreciate your interest in the scholarship program and encourage you to apply for future opportunities, provided you meet the eligibility criteria.

If you have any questions or need clarification, please feel free to contact us at bondadafoundationofficial@gmail.com.

Best regards,
Bondada Foundation Team`;

  } else {

    // Generic fallback for any other status
    subject  = `Update on Your Scholarship Application — ${applicationNumber}`;
    htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;">
      <p>Dear ${escapeHtml(studentName)},</p>
      <p>Your scholarship application (${escapeHtml(applicationNumber)}) status has been updated to <strong>${escapeHtml(newStatus)}</strong>.</p>
      <p>Best regards,<br/>Bondada Foundation Team</p>
    </body></html>`;
    textBody = `Dear ${studentName},\n\nYour application (${applicationNumber}) status has been updated to ${newStatus}.\n\nBondada Foundation Team`;
  }

  return sendMail({ to: studentEmail, subject, html: htmlBody, text: textBody });
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

// ============================================================
// HELPER — HTML escape
// ============================================================

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default { sendMail, sendScholarshipStatusEmail, sendDonationReceiptEmail };