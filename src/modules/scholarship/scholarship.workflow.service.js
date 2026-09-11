// ============================================================
// SCHOLARSHIP WORKFLOW SERVICE
//
// Status transitions are no longer hardcoded here. The allowed
// from -> to map lives in the `status_transition_rules` table
// (database/02_config_seed.sql) and is enforced inside
// sp_scholarship_status_change itself (it SIGNALs a 45000 error
// if the transition isn't configured). This means adding or
// changing workflow rules is a data change, not a redeploy.
// ============================================================

import { changeApplicationStatus as changeApplicationStatusRepo } from "./scholarship.repository.js";

const REASON_REQUIRED_STATUSES = ["not_eligible", "rejected"];

const REVIEW_TYPE_BY_STATUS = {
  eligible: "eligibility_review",
  not_eligible: "eligibility_review",
  approved: "final_approval",
  disbursed: "disbursement",
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
    // sp_scholarship_status_change SIGNALs 45000 for:
    // "Application not found." / "Invalid status transition..."
    if (err?.sqlState === "45000") {
      const message = err.sqlMessage || err.message || "";
      err.statusCode = message.includes("not found") ? 404 : 400;
    }
    throw err;
  }

  return {
    applicationId: result.application_id,
    oldStatus: result.old_status,
    newStatus: result.new_status,
    reason,
    remarks,
  };
};