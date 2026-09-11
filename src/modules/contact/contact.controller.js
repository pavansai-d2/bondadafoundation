import {
  submitContactMessage,
  getContactMessages,
  getContactMessageById,
  updateContactStatus,
  removeContactMessage,
} from "./contact.service.js";

const clientMeta = (req) => ({ ip: req.ip, userAgent: req.headers["user-agent"] || null });

// ============================================================
// PUBLIC: submit a contact message
// ============================================================

export const create = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const { ip } = clientMeta(req);

    const result = await submitContactMessage({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      sourcePage: req.body.sourcePage || req.headers.referer || null,
      ip,
    });

    res.status(201).json({
      success: true,
      message: "Thank you for reaching out. We will get back to you soon.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: list
// ============================================================

export const list = async (req, res, next) => {
  try {
    const { status, search, dateFrom, dateTo, page, pageSize } = req.query;

    const result = await getContactMessages({
      status: status || null,
      search: search || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: get one
// ============================================================

export const getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await getContactMessageById(id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: update status
// ============================================================

export const updateStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, remarks } = req.body;
    const { ip, userAgent } = clientMeta(req);

    await updateContactStatus({ id, status, remarks, adminId: req.admin.id, ip, userAgent });

    res.status(200).json({ success: true, message: "Contact message status updated." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: delete
// ============================================================

export const remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { ip, userAgent } = clientMeta(req);

    await removeContactMessage({ id, adminId: req.admin.id, ip, userAgent });

    res.status(200).json({ success: true, message: "Contact message deleted." });
  } catch (error) {
    next(error);
  }
};
