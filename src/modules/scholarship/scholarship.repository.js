// ============================================================
// SCHOLARSHIP REPOSITORY — calls stored procedures only.
// See database/02_procedures_scholarship.sql
// ============================================================

import { callProcedure, callProcedureMultiResult } from "../../utils/db.helper.js";

export const getAllScholarshipPrograms = async () => {
  return await callProcedure("sp_scholarship_program_list", []);
};

export const getScholarshipByCode = async (code) => {
  const rows = await callProcedure("sp_scholarship_program_get_by_code", [code]);
  return rows[0] || null;
};

export const getNextProgramApplicationNumber = async (scholarshipProgramId, year) => {
  const rows = await callProcedure("sp_scholarship_next_program_number", [scholarshipProgramId, year]);
  if (!rows.length) throw new Error("Unable to generate program application number.");
  return Number(rows[0].next_number);
};

// ============================================================
// RECENT-SUBMISSION CHECK
//
// Lets the frontend resolve the "the request failed at the network
// level, but did it actually reach the server?" ambiguity, instead
// of guessing. Deliberately scoped tight — only a very recent
// (last 30 minutes) match on program + aadhaar — and only ever
// returns the application number, never any other applicant data.
// ============================================================

export const findRecentApplicationByAadhaar = async (scholarshipProgramId, aadhaarNumber) => {
  const rows = await callProcedure("sp_scholarship_application_check_recent", [
    scholarshipProgramId,
    aadhaarNumber,
  ]);
  return rows[0] || null;
};

// ============================================================
// CREATE APPLICATION (application + academic_data JSON + initial
// history — one atomic call)
// ============================================================

export const createApplicationWithAcademicDetails = async (
  data,
  scholarshipProgramId,
  programApplicationNumber,
  year
) => {
  const rows = await callProcedure("sp_scholarship_application_create", [
    year,
    programApplicationNumber,
    scholarshipProgramId,
    data.fullName,
    data.dob,
    data.aadhar,
    data.mobile,
    data.email,
    data.referredByBondadaEmployee === true || data.referredByBondadaEmployee === "true" ? 1 : 0,
    data.referredByBondadaEmployee === true || data.referredByBondadaEmployee === "true"
      ? data.employeeName
      : null,
    data.referredByBondadaEmployee === true || data.referredByBondadaEmployee === "true"
      ? data.employeeId
      : null,
    data.parentName,
    data.parentAadhar || null,
    data.parentMobile,
    data.occupation,
    data.annualIncome,
    data.rationCardType,
    data.rationCardNumber,
    data.previouslyApplied === true || data.previouslyApplied === "true" ? 1 : 0,
    data.previousAppliedYear || null,
    data.previousScholarshipName || null,
    data.presentAddress,
    data.accountHolder,
    data.bankName,
    data.accountNumber,
    String(data.ifsc).toUpperCase(),
    data.branchName,
    JSON.stringify(data.academic || {}),
  ]);

  return rows[0]; // { application_id, application_number }
};


export const deleteApplication = async (applicationId) => {
  await callProcedure("sp_scholarship_application_delete", [applicationId]);
};

// ============================================================
// DOCUMENTS
// ============================================================

export const insertDocument = async (applicationId, documentType, file) => {
  const rows = await callProcedure("sp_scholarship_document_insert", [
    applicationId,
    documentType,
    file.originalname,
    file.filename,
    file.path,
    file.mimetype,
    file.size,
  ]);
  return rows[0]; // { document_id, document_version }
};

export const getApplicationDocuments = async (applicationId) => {
  return await callProcedure("sp_scholarship_document_list_by_application", [applicationId]);
};

export const getScholarshipDocumentById = async (documentId) => {
  const rows = await callProcedure("sp_scholarship_document_get", [documentId]);
  return rows[0] || null;
};

// ============================================================
// APPLICATIONS — list / get
// ============================================================

export const getApplications = async ({
  page = 1,
  limit = 20,
  status = null,
  scholarshipCode = null,
  search = null,
} = {}) => {
  const offset = (Number(page) - 1) * Number(limit);

  const rows = await callProcedureMultiResult("sp_scholarship_application_list", [
    status,
    scholarshipCode,
    search,
    Number(limit),
    Number(offset),
  ]);

  const applications = rows[0] || [];
  const total = Number(rows[1]?.[0]?.total || 0);

  return {
    applications,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

export const getApplicationById = async (applicationId) => {
  const results = await callProcedureMultiResult("sp_scholarship_application_get_by_id", [applicationId]);

  const application = results[0]?.[0];
  if (!application) return null;

  const academicRow = results[1]?.[0] || null;

  return {
    application,
    academic: academicRow
      ? (typeof academicRow.academic_data === "string"
          ? JSON.parse(academicRow.academic_data)
          : academicRow.academic_data)
      : null,
    documents: results[2] || [],
  };
};

// ============================================================
// STATISTICS — drives the admin dashboard
// ============================================================

export const getScholarshipStatistics = async () => {
  const results = await callProcedureMultiResult("sp_scholarship_statistics", []);
  const overall = results[0]?.[0] || {};
  const byProgram = results[1] || [];

  return {
    overall: {
      total: Number(overall.total || 0),
      pending: Number(overall.pending || 0),
      eligible: Number(overall.eligible || 0),
      nonEligible: Number(overall.nonEligible || 0),
      approved: Number(overall.approved || 0),
      rejected: Number(overall.rejected || 0),
    },
    byProgram,
  };
};

// ============================================================
// STATUS
// ============================================================

export const changeApplicationStatus = async (
  applicationId,
  newStatus,
  { reviewType = null, reason = null, remarks = null, changedBy = null } = {}
) => {
  const rows = await callProcedure("sp_scholarship_status_change", [
    applicationId,
    newStatus,
    reviewType,
    reason,
    remarks,
    changedBy,
  ]);
  return rows[0];
};

export const getApplicationStatusHistory = async (applicationId) => {
  return await callProcedure("sp_scholarship_status_history_get", [applicationId]);
};

export const getStatusTransitionOptions = async (currentStatus, programId) => {
  return await callProcedure("sp_status_transition_options", [currentStatus, programId]);
};

export const getDocumentTypeConfigByProgram = async (programId) => {
  return await callProcedure("sp_document_type_config_by_program", [programId]);
};

// ============================================================
// DISBURSEMENTS
// ============================================================

export const createDisbursement = async ({
  applicationId,
  approvedAmount,
  disbursedAmount = null,
  disbursementDate = null,
  paymentReference = null,
  paymentMode = null,
  remarks = null,
  createdBy = null,
}) => {
  const rows = await callProcedure("sp_scholarship_disbursement_create", [
    applicationId,
    approvedAmount,
    disbursedAmount,
    disbursementDate,
    paymentReference,
    paymentMode,
    remarks,
    createdBy,
  ]);
  return rows[0];
};