import { changeApplicationStatus } from "./scholarship.workflow.service.js";
import { getScholarshipApplicationById } from "./scholarship.service.js";
import { getValidNextStatuses } from "./scholarship.service.js";

// ============================================================
// CHANGE APPLICATION STATUS
//
// Permission required depends on the TARGET status, looked up
// dynamically from status_transition_rules (required_permission_code)
// rather than one hardcoded permission for the whole route. This
// is what makes "access for all to change application statuses"
// configurable via data instead of code: change the required
// permission for a transition with one UPDATE statement.
// ============================================================

export const changeStatus = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      const error = new Error("Invalid application ID.");
      error.statusCode = 400;
      throw error;
    }

    const { status, reason, remarks } = req.body;

    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!normalizedStatus) {
      const error = new Error("Status is required.");
      error.statusCode = 400;
      throw error;
    }

    // ----------------------------------------------------------
    // DYNAMIC PERMISSION CHECK
    // Look up the current application's status + program, then
    // find the permission required for this specific transition.
    // ----------------------------------------------------------

    const { application } = await getScholarshipApplicationById(applicationId);

    const options = await getValidNextStatuses(application.status, application.scholarship_program_id);

    const matchingRule = options.find((o) => o.to_status === normalizedStatus);

    if (!matchingRule) {
      const error = new Error(
        `Invalid status transition: ${application.status} -> ${normalizedStatus}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (matchingRule.required_permission_code) {
      const hasPermission = req.admin?.permissions?.includes(matchingRule.required_permission_code);

      if (!hasPermission) {
        const error = new Error(
          `You do not have permission to perform this action (${matchingRule.required_permission_code}).`
        );
        error.statusCode = 403;
        throw error;
      }
    }

    const adminId = req.admin?.id || null;

    const result = await changeApplicationStatus({
      applicationId,
      newStatus: normalizedStatus,
      reason,
      remarks,
      adminId,
    });

    res.status(200).json({
      success: true,
      message: "Application status updated successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET VALID NEXT STATUSES FOR AN APPLICATION
// Drives the admin frontend's status-change dropdown dynamically.
// ============================================================

export const getNextStatusOptions = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      const error = new Error("Invalid application ID.");
      error.statusCode = 400;
      throw error;
    }

    const { application } = await getScholarshipApplicationById(applicationId);
    const options = await getValidNextStatuses(application.status, application.scholarship_program_id);

    // Only show options the current admin is actually permitted to trigger
    const visibleOptions = options.filter(
      (o) => !o.required_permission_code || req.admin?.permissions?.includes(o.required_permission_code)
    );

    res.status(200).json({
      success: true,
      data: {
        currentStatus: application.status,
        options: visibleOptions,
      },
    });
  } catch (error) {
    next(error);
  }
};
