import express from "express";
import rateLimit from "express-rate-limit";

import {
  login,
  refresh,
  logout,
  me,
  createAdmin,
  listAdmins,
  listRoles,
  listPermissions,
  updateAdminStatus,
  changePassword,
  getAuditLogs,
} from "./admin.controller.js";

import {
  loginValidation,
  refreshValidation,
  createAdminValidation,
  updateAdminStatusValidation,
} from "./admin.validation.js";

import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import env from "../../config/env.js";

const router = express.Router();

// ============================================================
// LOGIN RATE LIMIT — tighter than the general API limiter,
// since this endpoint is the most attractive brute-force target.
// ============================================================

const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

// ============================================================
// PUBLIC (unauthenticated) AUTH ROUTES
// ============================================================

router.post("/auth/login", loginLimiter, loginValidation, validate, login);
router.post("/auth/refresh", refreshValidation, validate, refresh);

// ============================================================
// AUTHENTICATED ROUTES
// ============================================================

router.post("/auth/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.post("/me/change-password", authenticate, changePassword);

// ============================================================
// ADMIN MANAGEMENT — super_admin only, via admin.* permissions
// (dynamic: driven by admin_permissions/admin_role_permissions,
// not a hardcoded role check)
// ============================================================

router.get("/admins", authenticate, requirePermission("admin.view"), listAdmins);
router.post("/admins", authenticate, requirePermission("admin.create"), createAdminValidation, validate, createAdmin);
router.patch(
  "/admins/:id/status",
  authenticate,
  requirePermission("admin.disable"),
  updateAdminStatusValidation,
  validate,
  updateAdminStatus
);

router.get("/roles", authenticate, requirePermission("admin.view"), listRoles);
router.get("/permissions", authenticate, requirePermission("admin.view"), listPermissions);

// ============================================================
// AUDIT LOG
// ============================================================

router.get("/audit-logs", authenticate, requirePermission("audit.view"), getAuditLogs);

export default router;
