// ============================================================
// MAIL UTILITY — Bondada Foundation
// Using Resend API (https://resend.com)
//
// Render env vars required:
//   RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxx
//   MAIL_FROM      = Bondada Foundation <noreply@bondadafoundation.org>
// ============================================================

import env from "../config/env.js";

// ============================================================
// CORE SEND via Resend HTTP API
// ============================================================

export const sendMail = async ({ to, subject, text, html, from }) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[mailer] ❌ RESEND_API_KEY not set on Render environment.");
    return { sent: false, reason: "resend_api_key_missing" };
  }

  const fromAddress =
    from || env.mail.from || "Bondada Foundation <noreply@bondadafoundation.org>";

  try {
    console.log(`[mailer] Sending via Resend → ${to} | "${subject}"`);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      return {
        sent: false,
        reason: data?.message || `HTTP ${response.status}`,
      };
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

  // ==========================================================
  // APPROVED EMAIL
  // ==========================================================

  if (isApproved) {
    subject = `🎓 Congratulations! Selected for Bondada Nirmalavathi Scholarship 2026`;

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
  .bdy{padding:28px 32px;color:#333;line-height:1.85;font-size:15px;}
  .status-box{background:#d4edda;border-left:4px solid #28a745;padding:14px 20px;border-radius:4px;margin:20px 0;color:#155724;font-weight:bold;font-size:15px;}
  .event-box{background:#f0f4ff;border:1px solid #c3cff7;border-radius:6px;padding:20px 24px;margin:20px 0;}
  .event-box h3{margin:0 0 12px 0;color:#1a3c6e;font-size:16px;}
  .event-box table{width:100%;border-collapse:collapse;}
  .event-box td{padding:7px 0;font-size:14px;border:none;vertical-align:top;}
  .event-box td:first-child{color:#1a3c6e;font-weight:bold;width:70px;}
  .docs-box{background:#fffbea;border:1px solid #ffe082;border-radius:6px;padding:20px 24px;margin:20px 0;}
  .docs-box h3{margin:0 0 12px 0;color:#b45309;font-size:15px;}
  .docs-box ul{margin:0;padding-left:20px;}
  .docs-box ul li{margin-bottom:8px;font-size:14px;color:#444;}
  .warn-box{background:#fff3cd;border-left:4px solid #ffc107;padding:12px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#856404;}
  .info-table{width:100%;border-collapse:collapse;margin:18px 0;}
  .info-table tr:nth-child(odd){background:#f8f9fa;}
  .info-table td{padding:10px 14px;font-size:14px;border-bottom:1px solid #eee;}
  .info-table td:first-child{color:#666;width:45%;}
  .contact-box{background:#f0f4ff;border-radius:6px;padding:16px 20px;margin:18px 0;font-size:14px;}
  .contact-box p{margin:0 0 6px 0;}
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
    <p>🙏 <strong>Namaskaram from Bondada Foundation!</strong></p>
    <p>🎉 <strong>Congratulations! Selected for Bondada Nirmalavathi Scholarship 2026</strong></p>

    <p>Thank you for applying to the <strong>Bondada Nirmalavathi Scholarship 2026 Program</strong>.</p>
    <p>After careful review, we are delighted to inform you that your application has been approved and you have been <strong>selected for the Bondada Nirmalavathi Scholarship 2026</strong>.</p>

    <div class="status-box">
      ✅ Application Status: Selected – Meets the Eligibility Criteria.
    </div>

    <p>🎓 <strong>Congratulations on your selection!</strong></p>
    <p>We are pleased to invite you to attend the <strong>Bondada Nirmalavathi Scholarship 2026 Distribution Ceremony</strong> and receive your scholarship.</p>

    <div class="event-box">
      <h3>📅 Event Details</h3>
      <table>
        <tr><td>📅 Date</td><td><strong>Sunday, 25 October 2026</strong></td></tr>
        <tr><td>🕘 Time</td><td><strong>9:30 AM onwards</strong></td></tr>
        <tr><td>📍 Venue</td><td><strong>Gandhi Kshetram, Avanigadda, Krishna District, Andhra Pradesh</strong></td></tr>
      </table>
    </div>

    <div class="docs-box">
      <h3>📋 Important Instructions – Document Verification</h3>
      <p style="font-size:14px;margin:0 0 10px 0;">All selected students are required to <strong>bring their original documents for verification</strong> at the venue, including:</p>
      <ul>
        <li>🪪 <strong>Aadhaar Card</strong> – Original Aadhaar Card.</li>
        <li>📚 <strong>Academic Documents</strong> – Original academic certificates, mark sheets, and relevant educational records.</li>
        <li>📁 <strong>Other Supporting Documents</strong> – Originals of all documents uploaded by the applicant during the online registration process.</li>
      </ul>
    </div>

    <div class="warn-box">
      ⚠️ <strong>Important Note:</strong> Original document verification is <strong>mandatory</strong>. All selected students must carry the required documents and present them for verification at the venue.
    </div>

    <p>⏰ We request you to arrive at the venue on time with all the necessary documents to ensure a smooth verification and scholarship distribution process.</p>

    <table class="info-table">
      <tr><td>Application Number</td><td><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td>Scholarship</td><td>${escapeHtml(scholarshipName)}</td></tr>
      <tr><td>Status</td><td style="color:#155724;font-weight:bold;">Selected ✅</td></tr>
    </table>

    ${remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : ""}

    <div class="contact-box">
      <p>📞 <strong>Contact for Queries &amp; Assistance</strong></p>
      <p>For any questions or clarifications, please contact:</p>
      <p>👤 <strong>Mr. Anand Kumar</strong> – 7780205443</p>
      <p>👤 <strong>Mr. Ravi Teja</strong> – 8801444341</p>
    </div>

    <p>🌟 We sincerely appreciate your interest in the program and look forward to celebrating your academic achievements.</p>
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

Namaskaram from Bondada Foundation!

Congratulations! Selected for Bondada Nirmalavathi Scholarship 2026

Thank you for applying to the Bondada Nirmalavathi Scholarship 2026 Program.

After careful review, we are delighted to inform you that your application has been approved and you have been selected for the Bondada Nirmalavathi Scholarship 2026.

Application Status: Selected - Meets the Eligibility Criteria.

Congratulations on your selection!

We are pleased to invite you to attend the Bondada Nirmalavathi Scholarship 2026 Distribution Ceremony and receive your scholarship.

EVENT DETAILS:
Date  : Sunday, 25 October 2026
Time  : 9:30 AM onwards
Venue : Gandhi Kshetram, Avanigadda, Krishna District, Andhra Pradesh

IMPORTANT - DOCUMENT VERIFICATION:
All selected students must bring original documents for verification:
1. Aadhaar Card - Original
2. Academic Documents - Certificates, mark sheets, educational records
3. Other Supporting Documents - Originals of all documents uploaded during registration

IMPORTANT: Original document verification is mandatory. Please carry all documents.

Please arrive at the venue on time.

Application Number : ${applicationNumber}
Scholarship        : ${scholarshipName}
Status             : Selected

Contact for Queries & Assistance:
Mr. Anand Kumar - 7780205443
Mr. Ravi Teja   - 8801444341

We sincerely appreciate your interest in the program and look forward to celebrating your academic achievements.

Best regards,
Bondada Foundation Team`;

    // ==========================================================
    // REJECTED EMAIL
    // ==========================================================
  } else if (isRejected) {
    subject = `Bondada Nirmalavathi Scholarship 2026 – Application Status`;

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
  .bdy{padding:28px 32px;color:#333;line-height:1.85;font-size:15px;}
  .status-box{background:#f8d7da;border-left:4px solid #dc3545;padding:14px 20px;border-radius:4px;margin:20px 0;color:#721c24;font-weight:bold;font-size:15px;}
  .info-table{width:100%;border-collapse:collapse;margin:18px 0;}
  .info-table tr:nth-child(odd){background:#f8f9fa;}
  .info-table td{padding:10px 14px;font-size:14px;border-bottom:1px solid #eee;}
  .info-table td:first-child{color:#666;width:45%;}
  .contact-box{background:#f0f4ff;border-radius:6px;padding:16px 20px;margin:18px 0;font-size:14px;}
  .contact-box p{margin:0 0 6px 0;}
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
    <p>🙏 <strong>Namaskaram from Bondada Foundation!</strong></p>
    <p>🎓 <strong>Bondada Foundation Scholarship – Application Status</strong></p>

    <p>Thank you for applying to the <strong>Bondada Nirmalavathi Scholarship 2026</strong>.</p>
    <p>After careful review, we regret to inform you that we could not approve your application for the current scholarship cycle.</p>

    <div class="status-box">
      ❌ Application Status: Not Eligible – ${reason ? escapeHtml(reason) : "Application Does Not Meet the Eligibility Criteria."}
    </div>

    <table class="info-table">
      <tr><td>Application Number</td><td><strong>${escapeHtml(applicationNumber)}</strong></td></tr>
      <tr><td>Scholarship</td><td>${escapeHtml(scholarshipName)}</td></tr>
      <tr><td>Status</td><td style="color:#721c24;font-weight:bold;">Not Approved ❌</td></tr>
    </table>

    ${remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : ""}

    <p>We appreciate your interest in the scholarship program and encourage you to apply for future opportunities, provided you meet the eligibility criteria.</p>

    <div class="contact-box">
      <p>📞 <strong>Contact for Queries &amp; Assistance</strong></p>
      <p>For any questions or clarifications regarding your application status, please contact:</p>
      <p>👤 <strong>Mr. Subba Rao</strong> – 7702212389</p>
      <p>👤 <strong>Mr. Madhusudhan</strong> – 7893023784</p>
    </div>

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

Namaskaram from Bondada Foundation!

Bondada Foundation Scholarship - Application Status

Thank you for applying to the Bondada Nirmalavathi Scholarship 2026.

After careful review, we regret to inform you that we could not approve your application for the current scholarship cycle.

Application Status: Not Eligible - ${reason ? reason : "Application Does Not Meet the Eligibility Criteria."}

Application Number : ${applicationNumber}
Scholarship        : ${scholarshipName}
Status             : Not Approved

We appreciate your interest in the scholarship program and encourage you to apply for future opportunities, provided you meet the eligibility criteria.

Contact for Queries & Assistance:
Mr. Subba Rao    - 7702212389
Mr. Madhusudhan  - 7893023784

Best regards,
Bondada Foundation Team`;

    // ==========================================================
    // GENERIC FALLBACK
    // ==========================================================
  } else {
    subject = `Update on Your Scholarship Application — ${applicationNumber}`;
    htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;">
      <p>Dear ${escapeHtml(studentName)},</p>
      <p>Your scholarship application (${escapeHtml(applicationNumber)}) status has been updated to <strong>${escapeHtml(newStatus)}</strong>.</p>
      <p>Best regards,<br/>Bondada Foundation Team</p>
    </body></html>`;
    textBody = `Dear ${studentName},\n\nYour application (${applicationNumber}) status has been updated to ${newStatus}.\n\nBondada Foundation Team`;
  }

  return sendMail({
    to: studentEmail,
    subject,
    html: htmlBody,
    text: textBody,
  });
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
  const fmt = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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
    to: donorEmail,
    subject,
    html,
    text: `Dear ${donorName},\nDonation of ${fmt} received.\nCause: ${cause}\nTxn: ${transactionId}\nDate: ${paymentDate}\n\nBondada Foundation`,
  });
};

// ============================================================
// DONATION THANK-YOU EMAIL
// Sent automatically by the Razorpay webhook after a donation
// is captured on pages.razorpay.com/bondadafoundation
// ============================================================

export const sendDonationThankYouEmail = async ({ donorName, donorEmail, amount }) => {
  const name = (donorName || "Donor").trim();
  const isWhole = Number.isInteger(Number(amount));
  const amountText = Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const subject = "Thank You for Your Contribution | Bondada Foundation";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.7;margin:0;padding:20px;">
  <p>Dear ${escapeHtml(name)},</p>
  <p>Greetings from Bondada Foundation!</p>
  <p>We extend our heartfelt thanks for your generous contribution of <strong>\u20B9${escapeHtml(amountText)}</strong>.</p>
  <p>We sincerely appreciate your generosity and support. Your contribution strengthens our commitment to creating a positive impact in society. Thank you for being a valued part of our journey.</p>
  <p>With sincere gratitude,</p>
  <p><strong>Warm regards,</strong><br/>Team Bondada Foundation</p>
</body></html>`;

  const text = `Dear ${name},

Greetings from Bondada Foundation!

We extend our heartfelt thanks for your generous contribution of \u20B9${amountText}.

We sincerely appreciate your generosity and support. Your contribution strengthens our commitment to creating a positive impact in society. Thank you for being a valued part of our journey.

With sincere gratitude,

Warm regards,
Team Bondada Foundation`;

  // Sent from info@bondadafoundation.org (override with DONATION_MAIL_FROM).
  // The sending domain bondadafoundation.org must be verified in Resend.
  const from =
    process.env.DONATION_MAIL_FROM ||
    "Bondada Foundation <info@bondadafoundation.org>";

  return sendMail({ to: donorEmail, subject, html, text, from });
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

export default {
  sendMail,
  sendScholarshipStatusEmail,
  sendDonationReceiptEmail,
  sendDonationThankYouEmail,
};
