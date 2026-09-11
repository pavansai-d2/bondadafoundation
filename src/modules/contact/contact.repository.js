// ============================================================
// CONTACT REPOSITORY — calls stored procedures only.
// See database/05_procedures_contact.sql
// ============================================================

import { callProcedure, callProcedureMultiResult } from "../../utils/db.helper.js";

export const createContactMessage = async ({ name, email, phone, subject, message, sourcePage, ip }) => {
  const rows = await callProcedure("sp_contact_message_create", [
    name, email, phone, subject, message, sourcePage, ip,
  ]);
  return rows[0]?.contact_id;
};

export const listContactMessages = async ({
  status = null, search = null, dateFrom = null, dateTo = null, page = 1, pageSize = 20,
}) => {
  const offset = (Number(page) - 1) * Number(pageSize);

  const results = await callProcedureMultiResult("sp_contact_message_list", [
    status, search, dateFrom, dateTo, Number(pageSize), offset,
  ]);

  const messages = results[0] || [];
  const total = Number(results[1]?.[0]?.total || 0);

  return {
    messages,
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / Number(pageSize)),
    },
  };
};

export const getContactMessage = async (id) => {
  const results = await callProcedureMultiResult("sp_contact_message_get", [id]);

  const message = results[0]?.[0];

  if (!message) {
    return null;
  }

  return { message, history: results[1] || [] };
};

export const updateContactMessageStatus = async (id, newStatus, remarks, changedBy) => {
  await callProcedure("sp_contact_message_update_status", [id, newStatus, remarks, changedBy]);
};

export const deleteContactMessage = async (id) => {
  await callProcedure("sp_contact_message_delete", [id]);
};
