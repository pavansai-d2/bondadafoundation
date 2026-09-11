import {
  createContactMessage,
  listContactMessages,
  getContactMessage,
  updateContactMessageStatus,
  deleteContactMessage,
} from "./contact.repository.js";

import { insertAuditLog } from "../admin/admin.repository.js";

export const submitContactMessage = async ({ name, email, phone, subject, message, sourcePage, ip }) => {
  const id = await createContactMessage({ name, email, phone, subject, message, sourcePage, ip });
  return { id };
};

export const getContactMessages = async (filters) => {
  return await listContactMessages(filters);
};

export const getContactMessageById = async (id) => {
  const result = await getContactMessage(id);

  if (!result) {
    const error = new Error("Contact message not found.");
    error.statusCode = 404;
    throw error;
  }

  return result;
};

export const updateContactStatus = async ({ id, status, remarks, adminId, ip, userAgent }) => {
  try {
    await updateContactMessageStatus(id, status, remarks, adminId);
  } catch (err) {
    if (err?.sqlState === "45000") {
      err.statusCode = 404;
    }
    throw err;
  }

  await insertAuditLog({
    adminId,
    module: "contact",
    action: "update_status",
    entityType: "contact_message",
    entityId: id,
    newData: { status, remarks },
    ip,
    userAgent,
  });
};

export const removeContactMessage = async ({ id, adminId, ip, userAgent }) => {
  await deleteContactMessage(id);

  await insertAuditLog({
    adminId,
    module: "contact",
    action: "delete",
    entityType: "contact_message",
    entityId: id,
    ip,
    userAgent,
  });
};
