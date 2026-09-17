// ============================================================
// MAIL UTILITY
//
// Thin wrapper around nodemailer used to notify the foundation's
// mailbox (CONTACT_RECEIVER_EMAIL / defaults to
// info@bondadafoundation.org) whenever a public form is submitted.
//
// Required environment variables (set these on the host — GoDaddy
// Node.js Hosting / Vercel / wherever the backend runs):
//
//   SMTP_HOST      e.g. smtp.hostinger.com / smtp.gmail.com
//   SMTP_PORT      e.g. 587 (STARTTLS) or 465 (implicit TLS)
//   SMTP_SECURE    "true" for port 465, "false" for 587
//   SMTP_USER      the mailbox username used to authenticate
//   SMTP_PASSWORD  the mailbox password / app password
//   MAIL_FROM      optional — defaults to SMTP_USER
//   CONTACT_RECEIVER_EMAIL   optional — defaults to
//                            info@bondadafoundation.org
//
// If SMTP is not configured, sendMail() logs a warning and
// resolves with { sent: false } instead of throwing — a contact
// message must still be saved to the database even if mail
// delivery is unavailable.
// ============================================================

import nodemailer from "nodemailer";
import env from "../config/env.js";

let transporter = null;
let transporterKey = null;

const buildTransporterKey = () =>
  [env.mail.host, env.mail.port, env.mail.secure, env.mail.user, env.mail.password].join("|");

const getTransporter = () => {
  if (!env.mail.host || !env.mail.user || !env.mail.password) {
    return null;
  }

  const key = buildTransporterKey();

  if (transporter && transporterKey === key) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: {
      user: env.mail.user,
      pass: env.mail.password,
    },
  });

  transporterKey = key;

  return transporter;
};

/**
 * Sends an email. Never throws — callers that must not be blocked
 * by mail delivery (e.g. the public contact form, which has already
 * saved the message to the database) can call this without awaiting
 * it, or await it and just log the { sent: false } result.
 *
 * @param {{ to: string, subject: string, text?: string, html?: string, replyTo?: string }} options
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export const sendMail = async ({ to, subject, text, html, replyTo }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn(
      "[mailer] Email not sent — SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing)."
    );
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    await activeTransporter.sendMail({
      from: env.mail.from,
      to,
      subject,
      text,
      html,
      replyTo,
    });

    return { sent: true };
  } catch (error) {
    console.error("[mailer] Failed to send email:", error);
    return { sent: false, reason: error.message };
  }
};

export default { sendMail };
