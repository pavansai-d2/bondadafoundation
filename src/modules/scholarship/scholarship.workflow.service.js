// ============================================================
// SCHOLARSHIP WORKFLOW SERVICE
//
// After a successful status change to "approved" or "rejected",
// a notification email is sent to the student's registered email.
// Fire-and-forget — email failure never blocks the status change.
// ============================================================

import { changeApplicationStatus as changeApplicationStatusRepo } from "./scholarship.repository.js";
import { getApplicationById } from "./scholarship.repository.js";
import { sendScholarshipStatusEmail } from "../../utils/mailer.js";
import { EMAIL_NOTIFICATION_STATUSES } from "./scholarship.constants.js";

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
  // SEND STUDENT NOTIFICATION EMAIL
  // Fires for "approved" and "rejected" status changes only.
  // Completely non-blocking — errors are logged, never thrown.
  // ============================================================

  if (EMAIL_NOTIFICATION_STATUSES.includes(newStatus)) {
    console.log(`[workflow] Triggering status email for application ${applicationId} → ${newStatus}`);

    // Use setImmediate so the HTTP response is sent first,
    // then the email is attempted in the next event loop tick.
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
// INTERNAL — load application data then send the email
// ============================================================

async function _sendStatusNotification({ applicationId, newStatus, reason, remarks }) {
  try {
    console.log(`[workflow] Loading application ${applicationId} for status notification email...`);

    const appData = await getApplicationById(applicationId);

    if (!appData) {
      console.warn(`[workflow] Application ${applicationId} not found — email not sent.`);
      return;
    }

    const app = appData.application;

    // Validate required fields before calling mailer
    if (!app.email) {
      console.warn(`[workflow] Application ${applicationId} has no email address — cannot send notification.`);
      return;
    }

    if (!app.full_name) {
      console.warn(`[workflow] Application ${applicationId} has no full_name — using "Applicant" as fallback.`);
    }

    const scholarshipName = app.scholarship_subtitle
      ? `${app.scholarship_name} (${app.scholarship_subtitle})`
      : app.scholarship_name || "Bondada Foundation Scholarship";

    const applicationNumber =
      app.program_application_number || app.application_number || String(applicationId);

    console.log(`[workflow] Sending ${newStatus} email to ${app.email} for ${applicationNumber}`);

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
      console.log(`[workflow] ✅ Status email sent to ${app.email} (${applicationNumber})`);
    } else {
      console.error(`[workflow] ❌ Status email NOT sent to ${app.email} — reason: ${mailResult.reason}`);
    }

  } catch (err) {
    console.error(`[workflow] ❌ Unexpected error sending status notification for application ${applicationId}:`, err);
  }
}
