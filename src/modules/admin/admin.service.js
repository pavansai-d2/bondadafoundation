// ============================================================
// ADMIN SERVICE — auth flow + admin management
// ============================================================

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import env from "../../config/env.js";
import { ADMIN_STATUS } from "./admin.constants.js";

import {
  findAdminByEmail,
  findAdminById,
  createAdmin,
  listAdmins,
  updateAdminStatus,
  updateAdminPassword,
  getAdminPermissions,
  listAllRoles,
  resetLoginAttempts,
  incrementFailedLoginAttempts,
  insertLoginLog,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  insertAuditLog,
} from "./admin.repository.js";

const unauthorizedError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (admin) =>
  jwt.sign({ adminId: admin.id, roleCode: admin.role_code }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

const issueRefreshToken = async (adminId, ip, userAgent) => {
  const rawToken = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + env.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000
  );

  await createRefreshToken({ adminId, tokenHash, expiresAt, ip, userAgent });

  return rawToken;
};

// ============================================================
// LOGIN
// ============================================================

export const login = async ({ email, password, ip, userAgent }) => {
  const admin = await findAdminByEmail(email);

  if (!admin) {
    await insertLoginLog({
      adminId: null,
      email,
      status: "failed",
      ip,
      userAgent,
      failureReason: "Account not found.",
    });
    throw unauthorizedError("Invalid email or password.");
  }

  if (admin.status === ADMIN_STATUS.LOCKED || (admin.locked_until && new Date(admin.locked_until) > new Date())) {
    await insertLoginLog({
      adminId: admin.id,
      email,
      status: "locked",
      ip,
      userAgent,
      failureReason: "Account temporarily locked.",
    });

    const error = new Error(
      "This account is temporarily locked due to repeated failed login attempts. Please try again later."
    );
    error.statusCode = 423;
    throw error;
  }

  if (admin.status !== ADMIN_STATUS.ACTIVE) {
    await insertLoginLog({
      adminId: admin.id,
      email,
      status: "failed",
      ip,
      userAgent,
      failureReason: `Account status is ${admin.status}.`,
    });
    throw unauthorizedError("This account is not active. Contact a super administrator.");
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatches) {
    await incrementFailedLoginAttempts(admin.id);
    await insertLoginLog({
      adminId: admin.id,
      email,
      status: "failed",
      ip,
      userAgent,
      failureReason: "Incorrect password.",
    });
    throw unauthorizedError("Invalid email or password.");
  }

  await resetLoginAttempts(admin.id, ip);
  await insertLoginLog({ adminId: admin.id, email, status: "success", ip, userAgent });
  await insertAuditLog({ adminId: admin.id, module: "auth", action: "login", ip, userAgent });

  const accessToken = signAccessToken(admin);
  const refreshToken = await issueRefreshToken(admin.id, ip, userAgent);
  const permissions = await getAdminPermissions(admin.id);

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin.id,
      fullName: admin.full_name,
      email: admin.email,
      roleCode: admin.role_code,
      roleName: admin.role_name,
      permissions: permissions.map((p) => p.code),
    },
  };
};

// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================

export const refresh = async ({ refreshToken, ip, userAgent }) => {
  const tokenHash = hashToken(refreshToken);
  const tokenRow = await findRefreshToken(tokenHash);

  if (!tokenRow) {
    throw unauthorizedError("Invalid refresh token.");
  }

  if (tokenRow.revoked_at) {
    throw unauthorizedError("This refresh token has been revoked.");
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    throw unauthorizedError("Refresh token has expired. Please log in again.");
  }

  if (tokenRow.admin_status !== ADMIN_STATUS.ACTIVE) {
    throw unauthorizedError("This admin account is not active.");
  }

  const admin = await findAdminById(tokenRow.admin_id);

  // Rotate: revoke the old refresh token, issue a new one
  await revokeRefreshToken(tokenHash);
  const newRefreshToken = await issueRefreshToken(admin.id, ip, userAgent);

  const accessToken = signAccessToken({ id: admin.id, role_code: admin.role_code });

  return { accessToken, refreshToken: newRefreshToken };
};

// ============================================================
// LOGOUT
// ============================================================

export const logout = async ({ refreshToken, adminId, ip, userAgent }) => {
  if (refreshToken) {
    await revokeRefreshToken(hashToken(refreshToken));
  }

  if (adminId) {
    await insertAuditLog({ adminId, module: "auth", action: "logout", ip, userAgent });
  }
};

// ============================================================
// ME — current admin + permissions
// ============================================================

export const getMe = async (adminId) => {
  const admin = await findAdminById(adminId);

  if (!admin) {
    throw unauthorizedError("Admin account not found.");
  }

  const permissions = await getAdminPermissions(adminId);

  return {
    id: admin.id,
    fullName: admin.full_name,
    email: admin.email,
    mobile: admin.mobile,
    roleCode: admin.role_code,
    roleName: admin.role_name,
    status: admin.status,
    lastLoginAt: admin.last_login_at,
    permissions: permissions.map((p) => p.code),
  };
};

// ============================================================
// ADMIN MANAGEMENT (super_admin only, enforced at route level)
// ============================================================

export const createNewAdmin = async ({ roleId, fullName, email, mobile, password, actingAdminId, ip, userAgent }) => {
  const existing = await findAdminByEmail(email);

  if (existing) {
    const error = new Error("An admin with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const adminId = await createAdmin({ roleId, fullName, email, mobile, passwordHash });

  await insertAuditLog({
    adminId: actingAdminId,
    module: "admin",
    action: "create_admin",
    entityType: "admin",
    entityId: adminId,
    newData: { fullName, email, roleId },
    ip,
    userAgent,
  });

  return { id: adminId, fullName, email, roleId };
};

export const getAdminList = async (filters) => {
  return await listAdmins(filters);
};

export const getRoleList = async () => {
  return await listAllRoles();
};

export const changeAdminStatus = async ({ adminId, status, actingAdminId, ip, userAgent }) => {
  await updateAdminStatus(adminId, status);

  // Force re-authentication if being disabled/locked
  if (status !== ADMIN_STATUS.ACTIVE) {
    await revokeAllRefreshTokens(adminId);
  }

  await insertAuditLog({
    adminId: actingAdminId,
    module: "admin",
    action: "update_admin_status",
    entityType: "admin",
    entityId: adminId,
    newData: { status },
    ip,
    userAgent,
  });
};

export const changeOwnPassword = async ({ adminId, currentPassword, newPassword }) => {
  const admin = await findAdminByEmail((await findAdminById(adminId)).email);

  const matches = await bcrypt.compare(currentPassword, admin.password_hash);

  if (!matches) {
    throw unauthorizedError("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await updateAdminPassword(adminId, passwordHash);
  await revokeAllRefreshTokens(adminId);
};
