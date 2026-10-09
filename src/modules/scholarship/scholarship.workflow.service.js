// ============================================================
// SCHOLARSHIP WORKFLOW SERVICE
//
// Sends notification email to student when status changes to
// "approved" or "not_eligible" (as per requirement).
// Fire-and-forget — email failure never blocks status change.
// ============================================================

import { changeApplicationStatus as changeApplicationStatusRepo } from "./scholarship.repository.js";
import { getApplicationById } from "./scholarship.repository.js";
import { sendScholarshipStatusEmail } from "../../utils/mailer.js";
import { EMAIL_NOTIFICATION_STATUSES } from "./scholarship.constants.js";

// reason is REQUIRED for not_eligible (admin must explain why)
const REASON_REQUIRED_STATUSES = ["not_eligible", "rejected"];

const REVIEW_TYPE_BY_STATUS = {
  eligible:     "eligibility_review",
  not_eligible: "eligibility_review",
  approved:     "final_approval",
  disbursed:    "disbursement",
};

export const changeApplicationStatus = async ({
  applicationId,
  newStatus,
  reason = null,
  remarks = null,
  adminId = null,
}) => {
  if (REASON_REQUIRED_STATUSES.includes(newStatus) && !reason?.trim()) {
    const error = new Error(`A reason is required when changing status to ${newStatus}.`);
    error.statusCode = 422;
    throw error;
  }

  const reviewType = REVIEW_TYPE_BY_STATUS[newStatus] || "initial_review";

  let result;

  try {
    result = await changeApplicationStatusRepo(applicationId, newStatus, {
      reviewType,
      reason,
      remarks,
      changedBy: adminId,
    });
  } catch (err) {
    if (err?.sqlState === "45000") {
      const message = err.sqlMessage || err.message || "";
      err.statusCode = message.includes("not found") ? 404 : 400;
    }
    throw err;
  }

  // ============================================================
  // SEND EMAIL — fires for "approved" and "not_eligible" only
  // setImmediate sends HTTP response first, email second
  // ============================================================

  if (EMAIL_NOTIFICATION_STATUSES.includes(newStatus)) {
    console.log(`[workflow] Triggering status email for application ${applicationId} → ${newStatus}`);

    setImmediate(() => {
      _sendStatusNotification({
        applicationId,
        newStatus,
        reason,
        remarks,
      });
    });
  }

  return {
    applicationId: result.application_id,
    oldStatus:     result.old_status,
    newStatus:     result.new_status,
    reason,
    remarks,
  };
};

// ============================================================
// INTERNAL — fetch application details then send the email
// ============================================================

async function _sendStatusNotification({ applicationId, newStatus, reason, remarks }) {
  try {
    console.log(`[workflow] Loading application ${applicationId} for email...`);

    const appData = await getApplicationById(applicationId);

    if (!appData) {
      console.warn(`[workflow] Application ${applicationId} not found — email skipped.`);
      return;
    }

    const app = appData.application;

    if (!app.email) {
      console.warn(`[workflow] Application ${applicationId} has no email — cannot send.`);
      return;
    }

    const scholarshipName = app.scholarship_subtitle
      ? `${app.scholarship_name} (${app.scholarship_subtitle})`
      : app.scholarship_name || "Bondada Foundation Scholarship";

    const applicationNumber =
      app.program_application_number || app.application_number || String(applicationId);

    console.log(`[workflow] Sending "${newStatus}" email to ${app.email} — ${applicationNumber}`);

    const mailResult = await sendScholarshipStatusEmail({
      studentName:       app.full_name || "Applicant",
      studentEmail:      app.email,
      applicationNumber,
      scholarshipName,
      newStatus,
      reason,
      remarks,
    });

    if (mailResult.sent) {
      console.log(`[workflow] ✅ Email sent to ${app.email} (${applicationNumber})`);
    } else {
      console.error(`[workflow] ❌ Email FAILED to ${app.email} — reason: ${mailResult.reason}`);
    }

  } catch (err) {
    console.error(`[workflow] ❌ Unexpected error for application ${applicationId}:`, err.message);
  }
}
