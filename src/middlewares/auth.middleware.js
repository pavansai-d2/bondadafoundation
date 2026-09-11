// ============================================================
// AUTH MIDDLEWARE
//
// Verifies the admin's JWT access token and attaches
// req.admin = { id, fullName, email, roleCode, permissions[] }.
//
// Permissions are re-fetched from the DB on every request
// (small admin count, cheap query) rather than trusted from
// the JWT payload — this means revoking/granting a permission
// to an admin takes effect on their very next request, not
// only after their token expires. This is the mechanism behind
// "access for all to change their application statuses":
// permission codes are data (admin_role_permissions), checked
// dynamically, never hardcoded per-route.
// ============================================================

import jwt from "jsonwebtoken";

import env from "../config/env.js";
import { findAdminById, getAdminPermissions } from "../modules/admin/admin.repository.js";

const unauthorized = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const forbidden = (message) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

// ============================================================
// AUTHENTICATE — verifies the JWT, loads the admin + their
// current permissions, attaches both to req.admin
// ============================================================

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw unauthorized("Authentication token is required.");
    }

    let payload;

    try {
      payload = jwt.verify(token, env.jwt.secret);
    } catch {
      throw unauthorized("Invalid or expired authentication token.");
    }

    const admin = await findAdminById(payload.adminId);

    if (!admin) {
      throw unauthorized("Admin account not found.");
    }

    if (admin.status !== "active") {
      throw forbidden("This admin account is not active.");
    }

    const permissionRows = await getAdminPermissions(admin.id);

    req.admin = {
      id: admin.id,
      fullName: admin.full_name,
      email: admin.email,
      roleId: admin.role_id,
      roleCode: admin.role_code,
      roleName: admin.role_name,
      permissions: permissionRows.map((p) => p.code),
    };

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================
// REQUIRE PERMISSION — dynamic, code-driven check.
// Usage: router.patch("/x", authenticate, requirePermission("scholarship.approve"), ctrl)
// ============================================================

export const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(unauthorized("Authentication is required."));
    }

    if (!req.admin.permissions.includes(permissionCode)) {
      return next(forbidden(`You do not have permission to perform this action (${permissionCode}).`));
    }

    next();
  };
};

// ============================================================
// REQUIRE ANY PERMISSION — passes if the admin holds at least
// one of the given codes. Useful for routes several roles share.
// ============================================================

export const requireAnyPermission = (permissionCodes = []) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(unauthorized("Authentication is required."));
    }

    const hasAny = permissionCodes.some((code) => req.admin.permissions.includes(code));

    if (!hasAny) {
      return next(forbidden("You do not have permission to perform this action."));
    }

    next();
  };
};

export default { authenticate, requirePermission, requireAnyPermission };
