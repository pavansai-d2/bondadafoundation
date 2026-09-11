// ============================================================
// ADMIN REPOSITORY
//
// Thin wrapper layer. Every function here calls a stored
// procedure — no inline SQL. See:
//   database/04_procedures_admin.sql
// ============================================================

import { callProcedure } from "../../utils/db.helper.js";
import env from "../../config/env.js";

// ============================================================
// FIND / CREATE / LIST ADMINS
// ============================================================

export const findAdminByEmail = async (email) => {
  const rows = await callProcedure("sp_admin_find_by_email", [email]);
  return rows[0] || null;
};

export const findAdminById = async (adminId) => {
  const rows = await callProcedure("sp_admin_find_by_id", [adminId]);
  return rows[0] || null;
};

export const createAdmin = async ({ roleId, fullName, email, mobile, passwordHash }) => {
  const rows = await callProcedure("sp_admin_create", [roleId, fullName, email, mobile, passwordHash]);
  return rows[0]?.admin_id;
};

export const listAdmins = async ({ roleId = null, status = null } = {}) => {
  return await callProcedure("sp_admin_list", [roleId, status]);
};

export const updateAdminStatus = async (adminId, status) => {
  await callProcedure("sp_admin_update_status", [adminId, status]);
};

export const updateAdminPassword = async (adminId, passwordHash) => {
  await callProcedure("sp_admin_update_password", [adminId, passwordHash]);
};

// ============================================================
// PERMISSIONS (dynamic — this is how "access for all to change
// application statuses" is enforced per-admin: a permission
// code, looked up fresh every login/refresh, not a hardcoded
// role check anywhere in route code)
// ============================================================

export const getAdminPermissions = async (adminId) => {
  return await callProcedure("sp_admin_permissions_get", [adminId]);
};

export const listAllRoles = async () => {
  return await callProcedure("sp_admin_roles_list", []);
};

export const listAllPermissions = async () => {
  return await callProcedure("sp_admin_permissions_list_all", []);
};

// ============================================================
// LOGIN ATTEMPT / LOCKOUT TRACKING
// ============================================================

export const resetLoginAttempts = async (adminId, ipAddress) => {
  await callProcedure("sp_admin_update_login_success", [adminId, ipAddress]);
};

export const incrementFailedLoginAttempts = async (adminId) => {
  await callProcedure("sp_admin_update_login_failure", [
    adminId,
    env.adminAuth.maxFailedLoginAttempts,
    env.adminAuth.lockDurationMinutes,
  ]);
};

export const insertLoginLog = async ({ adminId, email, status, ip, userAgent, failureReason = null }) => {
  await callProcedure("sp_admin_login_log_insert", [adminId, email, status, ip, userAgent, failureReason]);
};

// ============================================================
// REFRESH TOKENS
// ============================================================

export const createRefreshToken = async ({ adminId, tokenHash, expiresAt, ip, userAgent }) => {
  const rows = await callProcedure("sp_admin_refresh_token_insert", [
    adminId, tokenHash, expiresAt, ip, userAgent,
  ]);
  return rows[0]?.token_id;
};

export const findRefreshToken = async (tokenHash) => {
  const rows = await callProcedure("sp_admin_refresh_token_validate", [tokenHash]);
  return rows[0] || null;
};

export const revokeRefreshToken = async (tokenHash) => {
  await callProcedure("sp_admin_refresh_token_revoke", [tokenHash]);
};

export const revokeAllRefreshTokens = async (adminId) => {
  await callProcedure("sp_admin_refresh_token_revoke_all", [adminId]);
};

// ============================================================
// AUDIT LOG
// ============================================================

export const insertAuditLog = async ({
  adminId, module, action, entityType = null, entityId = null,
  oldData = null, newData = null, ip = null, userAgent = null,
}) => {
  await callProcedure("sp_admin_audit_log_insert", [
    adminId, module, action, entityType, entityId,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    ip, userAgent,
  ]);
};

export const listAuditLogs = async ({ adminId = null, module = null, page = 1, pageSize = 50 } = {}) => {
  return await callProcedure("sp_admin_audit_log_list", [adminId, module, page, pageSize]);
};
