import express from "express";

import {
  getScholarships,
  getScholarshipByCode,
  getRequiredDocuments,
  submitScholarshipApplication,
  checkRecentApplicationSubmission,
  getApplications,
  getApplicationById,
  getApplicationHistory,
  getApplicationDocuments,
  getScholarshipStatisticsController,
  viewScholarshipDocument,
  downloadScholarshipDocument,
} from "./scholarship.controller.js";

import { changeStatus, getNextStatusOptions } from "./scholarship.workflow.controller.js";

import { scholarshipUpload } from "../../middlewares/upload.middleware.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// =====================================================
// PUBLIC ROUTES
// =====================================================

router.get("/programs", getScholarships);
router.get("/programs/:code", getScholarshipByCode);
router.get("/programs/:code/documents", getRequiredDocuments);

// ScholarshipForm.jsx uploads 6 files: aadharFile, photoFile,
// marksFile, incomeCertificate, bankPassbook, rationCardFile
router.post(
  "/applications",
  scholarshipUpload.fields([
    { name: "aadharFile", maxCount: 1 },
    { name: "photoFile", maxCount: 1 },
    { name: "marksFile", maxCount: 1 },
    { name: "incomeCertificate", maxCount: 1 },
    { name: "bankPassbook", maxCount: 1 },
    { name: "rationCardFile", maxCount: 1 },
  ]),
  submitScholarshipApplication
);

// PUBLIC — must stay above the admin "/applications/:id" route below,
// or Express would match "check" as an :id. Used only to resolve a
// network-level submission failure client-side (see controller).
router.get("/applications/check", checkRecentApplicationSubmission);

// =====================================================
// ADMIN ROUTES — authentication + permission required
// =====================================================

router.get("/statistics", authenticate, requirePermission("scholarship.view"), getScholarshipStatisticsController);

router.get("/applications", authenticate, requirePermission("scholarship.view"), getApplications);
router.get("/applications/:id", authenticate, requirePermission("scholarship.view"), getApplicationById);
router.get("/applications/:id/history", authenticate, requirePermission("scholarship.view"), getApplicationHistory);
router.get("/applications/:id/documents", authenticate, requirePermission("scholarship.view"), getApplicationDocuments);
router.get("/applications/:id/next-statuses", authenticate, requirePermission("scholarship.view"), getNextStatusOptions);

router.get("/documents/:documentId/view", authenticate, requirePermission("scholarship.document_view"), viewScholarshipDocument);
router.get("/documents/:documentId/download", authenticate, requirePermission("scholarship.document_download"), downloadScholarshipDocument);

// Permission required looked up dynamically per-transition inside changeStatus
// (see status_transition_rules / scholarship.workflow.controller.js)
router.patch("/applications/:id/status", authenticate, changeStatus);

export default router;