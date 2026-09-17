import fs from "fs";
import path from "path";

import {
  getAllScholarships,
  getScholarship,
  createScholarshipApplication,
  getScholarshipApplications,
  getScholarshipApplicationById,
  getScholarshipApplicationHistory,
  getScholarshipApplicationDocuments,
  getScholarshipDocument,
  getRequiredDocumentsForProgram,
  getStatistics,
  getStatisticsByProgram,
  checkRecentSubmission,
} from "./scholarship.service.js";

import { resolveDocumentAccess, scholarshipDocumentExists } from "../../utils/fileStorage.js";
import { insertAuditLog } from "../admin/admin.repository.js";

// ============================================================
// PROGRAMS
// ============================================================

export const getScholarships = async (req, res, next) => {
  try {
    const scholarships = await getAllScholarships();
    res.status(200).json({ success: true, data: scholarships });
  } catch (error) {
    next(error);
  }
};

export const getScholarshipByCode = async (req, res, next) => {
  try {
    const scholarship = await getScholarship(req.params.code);
    res.status(200).json({ success: true, data: scholarship });
  } catch (error) {
    next(error);
  }
};

export const getRequiredDocuments = async (req, res, next) => {
  try {
    const scholarship = await getScholarship(req.params.code);
    const documents = await getRequiredDocumentsForProgram(scholarship.id);
    res.status(200).json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CREATE APPLICATION
// ============================================================

export const submitScholarshipApplication = async (req, res, next) => {
  try {
    let data;

    try {
      data = JSON.parse(req.body.application);
    } catch {
      const error = new Error("The application field must contain valid JSON.");
      error.statusCode = 400;
      throw error;
    }

    const result = await createScholarshipApplication(data, req.files || {});

    // The production proxy has intermittently delivered the HTTP
    // status and headers but failed while the browser was reading the
    // JSON response body. The database and all documents were already
    // committed in those cases. Return a body-free HTTP 200 response
    // and expose the two identifiers in CORS-readable headers.
    res.status(200).json({
    success: true,
    message: "Scholarship application submitted successfully.",
    data: {
        applicationNumber: result.applicationNumber,
        programApplicationNumber: result.programApplicationNumber
    }
});
  } catch (error) {
    next(error);
  }
};

// ============================================================
// RECENT-SUBMISSION CHECK
//
// Called by the frontend ONLY after a submission fails at the raw
// network level (no HTTP response reached the browser at all), to
// find out whether it actually reached the server before deciding
// what to tell the applicant. See scholarship.repository.js for
// why this is scoped to "last 30 minutes, program + aadhaar only".
// ============================================================

export const checkRecentApplicationSubmission = async (req, res, next) => {
  try {
    const { scholarshipCode, aadhar } = req.query;

    if (!scholarshipCode || !aadhar) {
      const error = new Error("scholarshipCode and aadhar are required.");
      error.statusCode = 400;
      throw error;
    }

    const result = await checkRecentSubmission(
      scholarshipCode,
      String(aadhar)
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Recovery endpoint: never turn a failed confirmation lookup
    // into another user-facing 500 response.
    console.error(
      "Recent scholarship submission check failed:",
      error
    );

    return res.status(200).json({
      success: true,
      data: { found: false },
    });
  }
};


// ============================================================
// APPLICATIONS — list / get / history / documents
// ============================================================

export const getApplications = async (req, res, next) => {
  try {
    const { page, limit, status, scholarshipCode, search } = req.query;

    const result = await getScholarshipApplications({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status: status || null,
      scholarshipCode: scholarshipCode || null,
      search: search || null,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getApplicationById = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);
    const result = await getScholarshipApplicationById(applicationId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getApplicationHistory = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);
    const history = await getScholarshipApplicationHistory(applicationId);
    res.status(200).json({ success: true, data: { history } });
  } catch (error) {
    next(error);
  }
};

export const getApplicationDocuments = async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);
    const documents = await getScholarshipApplicationDocuments(applicationId);
    res.status(200).json({ success: true, data: { documents } });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// STATISTICS — drives AdminDashboard.jsx
// ============================================================

export const getScholarshipStatisticsController = async (req, res, next) => {
  try {
    const stats = await getStatistics();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// STATISTICS — single program (drives the per-program statistics
// page, e.g. "SSC Level")
// ============================================================

export const getScholarshipStatisticsByProgramController = async (req, res, next) => {
  try {
    const stats = await getStatisticsByProgram(req.params.code);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DOCUMENT VIEW / DOWNLOAD (short-lived R2 presigned URL, or
// local stream in dev)
// ============================================================

export const viewScholarshipDocument = async (req, res, next) => {
  try {
    const documentId = Number(req.params.documentId);
    const document = await getScholarshipDocument(documentId);

    const exists = await scholarshipDocumentExists(document);
    if (!exists) {
      const error = new Error("Scholarship document file not found.");
      error.statusCode = 404;
      throw error;
    }

    if (req.admin) {
      await insertAuditLog({
        adminId: req.admin.id,
        module: "scholarship",
        action: "view_document",
        entityType: "scholarship_document",
        entityId: documentId,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      });
    }

    const access = await resolveDocumentAccess(document, { download: false });

    if (access.type === "url") {
      return res.redirect(302, access.value);
    }

    let mimeType = document.mime_type;

    if (!mimeType || mimeType === "application/octet-stream") {
      const extension = path.extname(document.original_name).toLowerCase();
      const mimeTypes = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
      mimeType = mimeTypes[extension] || "application/octet-stream";
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "inline");

    const stream = fs.createReadStream(access.value);
    stream.on("error", (error) => next(error));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const downloadScholarshipDocument = async (req, res, next) => {
  try {
    const documentId = Number(req.params.documentId);
    const document = await getScholarshipDocument(documentId);

    const exists = await scholarshipDocumentExists(document);
    if (!exists) {
      const error = new Error("Scholarship document file not found.");
      error.statusCode = 404;
      throw error;
    }

    if (req.admin) {
      await insertAuditLog({
        adminId: req.admin.id,
        module: "scholarship",
        action: "download_document",
        entityType: "scholarship_document",
        entityId: documentId,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      });
    }

    const access = await resolveDocumentAccess(document, { download: true });

    if (access.type === "url") {
      return res.redirect(302, access.value);
    }

    res.download(access.value, document.original_name, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};