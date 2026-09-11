import {
  login as loginService,
  refresh as refreshService,
  logout as logoutService,
  getMe as getMeService,
  createNewAdmin,
  getAdminList,
  getRoleList,
  changeAdminStatus,
  changeOwnPassword,
} from "./admin.service.js";

import { listAllPermissions, listAuditLogs } from "./admin.repository.js";

const clientMeta = (req) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"] || null,
});

// ============================================================
// LOGIN
// ============================================================

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { ip, userAgent } = clientMeta(req);

    const result = await loginService({ email, password, ip, userAgent });

    res.status(200).json({ success: true, message: "Login successful.", data: result });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// REFRESH
// ============================================================

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const { ip, userAgent } = clientMeta(req);

    const result = await refreshService({ refreshToken, ip, userAgent });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// LOGOUT
// ============================================================

export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const { ip, userAgent } = clientMeta(req);

    await logoutService({ refreshToken, adminId: req.admin?.id, ip, userAgent });

    res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ME
// ============================================================

export const me = async (req, res, next) => {
  try {
    const admin = await getMeService(req.admin.id);
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN MANAGEMENT (super_admin — enforced via requirePermission)
// ============================================================

export const createAdmin = async (req, res, next) => {
  try {
    const { roleId, fullName, email, mobile, password } = req.body;
    const { ip, userAgent } = clientMeta(req);

    const result = await createNewAdmin({
      roleId,
      fullName,
      email,
      mobile,
      password,
      actingAdminId: req.admin.id,
      ip,
      userAgent,
    });

    res.status(201).json({ success: true, message: "Admin created successfully.", data: result });
  } catch (error) {
    next(error);
  }
};

export const listAdmins = async (req, res, next) => {
  try {
    const { roleId, status } = req.query;
    const admins = await getAdminList({
      roleId: roleId ? Number(roleId) : null,
      status: status || null,
    });

    res.status(200).json({ success: true, data: admins });
  } catch (error) {
    next(error);
  }
};

export const listRoles = async (req, res, next) => {
  try {
    const roles = await getRoleList();
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
};

export const listPermissions = async (req, res, next) => {
  try {
    const permissions = await listAllPermissions();
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
};

export const updateAdminStatus = async (req, res, next) => {
  try {
    const adminId = Number(req.params.id);
    const { status } = req.body;
    const { ip, userAgent } = clientMeta(req);

    await changeAdminStatus({ adminId, status, actingAdminId: req.admin.id, ip, userAgent });

    res.status(200).json({ success: true, message: "Admin status updated successfully." });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    await changeOwnPassword({ adminId: req.admin.id, currentPassword, newPassword });

    res.status(200).json({ success: true, message: "Password changed successfully. Please log in again." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// AUDIT LOG
// ============================================================

export const getAuditLogs = async (req, res, next) => {
  try {
    const { adminId, module, page, pageSize } = req.query;

    const logs = await listAuditLogs({
      adminId: adminId ? Number(adminId) : null,
      module: module || null,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
