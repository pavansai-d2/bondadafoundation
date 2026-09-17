import {
  createContactMessage,
  listContactMessages,
  getContactMessage,
  updateContactMessageStatus,
  deleteContactMessage,
} from "./contact.repository.js";

import { insertAuditLog } from "../admin/admin.repository.js";
import { sendMail } from "../../utils/mailer.js";
import env from "../../config/env.js";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

// Best-effort notification to the foundation's mailbox. The contact
// message is already saved to the database by the time this runs, so
// a mail delivery failure here must never surface as a failed
// submission to the person filling out the form.
const notifyOwnerOfContactMessage = ({ id, name, email, phone, subject, message, sourcePage }) => {
  const mailSubject = `New Contact Message: ${subject || "Website Enquiry"} — ${name}`;

  const text = [
    `New message from the Bondada Foundation contact form (#${id}).`,
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    subject ? `Subject: ${subject}` : null,
    sourcePage ? `Page: ${sourcePage}` : null,
    "",
    "Message:",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
      <h2 style="margin: 0 0 12px;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
      ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
      ${sourcePage ? `<p><strong>Page:</strong> ${escapeHtml(sourcePage)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  sendMail({
    to: env.mail.contactReceiver,
    subject: mailSubject,
    text,
    html,
    replyTo: email,
  }).then((result) => {
    if (!result.sent) {
      console.warn(`[contact] Notification email for message #${id} was not sent: ${result.reason}`);
    }
  });
};

export const submitContactMessage = async ({ name, email, phone, subject, message, sourcePage, ip }) => {
  const id = await createContactMessage({ name, email, phone, subject, message, sourcePage, ip });

  notifyOwnerOfContactMessage({ id, name, email, phone, subject, message, sourcePage });

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
