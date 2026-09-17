import {
  getAllScholarshipPrograms,
  getScholarshipByCode,
  getNextProgramApplicationNumber,
  deleteApplication,
  createApplicationWithAcademicDetails,
  insertDocument,
  getApplications,
  getApplicationById,
  getApplicationStatusHistory,
  getApplicationDocuments,
  getScholarshipDocumentById,
  getStatusTransitionOptions,
  getDocumentTypeConfigByProgram,
  getScholarshipStatistics,
  getScholarshipStatisticsByProgram,
  findRecentApplicationByAadhaar,
} from "./scholarship.repository.js";

import { validateScholarshipApplication } from "./scholarship.validation.js";
import { processIncomingFile, deleteStoredDocument } from "../../utils/fileStorage.js";
import { DOCUMENT_FIELD_MAP } from "./scholarship.constants.js";

export const getAllScholarships = async () => {
  return await getAllScholarshipPrograms();
};

export const getScholarship = async (code) => {
  const scholarship = await getScholarshipByCode(code);
  if (!scholarship) {
    const error = new Error("Scholarship program not found.");
    error.statusCode = 404;
    throw error;
  }
  return scholarship;
};

// ============================================================
// RECENT-SUBMISSION CHECK — see repository for scope/rationale.
// Returns { found: false } rather than throwing when nothing
// matches, since "not found" is an expected, normal outcome here,
// not an error condition.
// ============================================================

export const checkRecentSubmission = async (scholarshipCode, aadhaarNumber) => {
  const scholarship = await getScholarshipByCode(scholarshipCode);

  if (!scholarship) {
    const error = new Error("Selected scholarship does not exist.");
    error.statusCode = 400;
    throw error;
  }

  const match = await findRecentApplicationByAadhaar(scholarship.id, aadhaarNumber);

  if (!match) {
    return { found: false };
  }

  return {
    found: true,
    applicationNumber: match.application_number,
    programApplicationNumber: match.program_application_number,
  };
};

export const getScholarshipApplicationById = async (applicationId) => {
  const application = await getApplicationById(applicationId);
  if (!application) {
    const error = new Error("Scholarship application not found.");
    error.statusCode = 404;
    throw error;
  }
  return application;
};

export const getScholarshipApplicationHistory = async (applicationId) => {
  return await getApplicationStatusHistory(applicationId);
};

export const getScholarshipApplicationDocuments = async (applicationId) => {
  return await getApplicationDocuments(applicationId);
};

export const getScholarshipDocument = async (documentId) => {
  const document = await getScholarshipDocumentById(documentId);
  if (!document) {
    const error = new Error("Scholarship document not found.");
    error.statusCode = 404;
    throw error;
  }
  return document;
};

export const getScholarshipApplications = async ({
  page = 1,
  limit = 20,
  status = null,
  scholarshipCode = null,
  search = null,
} = {}) => {
  page = Number(page);
  if (!Number.isInteger(page) || page < 1) page = 1;

  limit = Number(limit);
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  return await getApplications({
    page,
    limit,
    status: status || null,
    scholarshipCode: scholarshipCode || null,
    search: search?.trim() || null,
  });
};

export const getRequiredDocumentsForProgram = async (programId) => {
  return await getDocumentTypeConfigByProgram(programId);
};

export const getValidNextStatuses = async (currentStatus, programId) => {
  return await getStatusTransitionOptions(currentStatus, programId);
};

export const getStatistics = async () => {
  return await getScholarshipStatistics();
};

export const getStatisticsByProgram = async (code) => {
  const scholarship = await getScholarshipByCode(code);

  if (!scholarship) {
    const error = new Error("Scholarship program not found.");
    error.statusCode = 404;
    throw error;
  }

  return await getScholarshipStatisticsByProgram(code);
};

// ============================================================
// CREATE SCHOLARSHIP APPLICATION
// ============================================================

export const createScholarshipApplication = async (data, files) => {
  const errors = validateScholarshipApplication(data, files);
  if (errors.length) {
    const error = new Error("Application validation failed.");
    error.statusCode = 422;
    error.details = errors;
    throw error;
  }

  const scholarship = await getScholarshipByCode(data.scholarshipCode);
  if (!scholarship) {
    const error = new Error("Selected scholarship does not exist.");
    error.statusCode = 400;
    throw error;
  }

  // Validate all six files before touching the database.
  const fileEntries = Object.entries(DOCUMENT_FIELD_MAP).map(([fieldName, documentType]) => {
    const file = files[fieldName]?.[0];
    if (!file) {
      const error = new Error(`${fieldName} document is missing.`);
      error.statusCode = 422;
      throw error;
    }
    return { fieldName, documentType, file };
  });

  const year = new Date().getFullYear();
  const programApplicationId = await getNextProgramApplicationNumber(scholarship.id, year);
  const programApplicationNumber = `BF-${year}-${scholarship.code.toUpperCase()}-${String(programApplicationId).padStart(4, "0")}`;

  let applicationId = null;
  const storedDocuments = [];

  try {
    // DB transaction creates the application + academic data + initial history.
    // Document uploads happen afterward because R2 cannot participate in a MySQL transaction.
    const created = await createApplicationWithAcademicDetails(
      data,
      scholarship.id,
      programApplicationNumber,
      year
    );

    applicationId = created.application_id;

    // Upload all documents concurrently. If any upload fails, compensate by deleting
    // successfully uploaded R2 objects and the just-created DB application.
    const uploadResults = await Promise.allSettled(
      fileEntries.map(async ({ documentType, file }) => {
        const storedFile = await processIncomingFile(file, {
          scholarshipProgramId: scholarship.id,
          programApplicationNumber,
          documentType,
        });
        storedDocuments.push(storedFile);
        await insertDocument(applicationId, documentType, storedFile);
      })
    );

    const failedUpload = uploadResults.find((result) => result.status === "rejected");
    if (failedUpload) {
      throw failedUpload.reason;
    }

    return {
      applicationId,
      applicationNumber: created.application_number,
      programApplicationNumber,
      status: "applied",
      scholarship: { id: scholarship.id, code: scholarship.code, name: scholarship.name },
    };
  } catch (error) {
    console.error("Scholarship submission failed during database/storage processing:", {
      code: error?.code,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      message: error?.message,
      scholarshipCode: data.scholarshipCode,
      applicationId,
      programApplicationNumber,
    });

    // Best-effort cleanup. Do not mask the original failure.
    await Promise.allSettled(
      storedDocuments.map((document) => deleteStoredDocument(document))
    );

    if (applicationId) {
      try {
        await deleteApplication(applicationId);
      } catch (cleanupError) {
        console.error("Failed to clean up application after submission failure:", cleanupError);
      }
    }

    throw error;
  }
};

// ============================================================
// RESUBMIT CORRECTED SCHOLARSHIP DOCUMENT
// (removed — no needs_correction/resubmitted status in the
// simplified workflow, so document resubmission has no purpose)
// ============================================================