import { body, query } from "express-validator";
import { CONTACT_STATUSES } from "./contact.constants.js";

export const createContactValidation = [
  body("name").trim().notEmpty().withMessage("Name is required.").isLength({ max: 150 }),
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("phone").optional({ nullable: true }).trim().isLength({ max: 20 }),
  body("subject").optional({ nullable: true }).trim().isLength({ max: 255 }),
  body("message").trim().notEmpty().withMessage("Message is required.").isLength({ max: 5000 }),
];

export const updateContactStatusValidation = [
  body("status").isIn(CONTACT_STATUSES).withMessage(`Status must be one of: ${CONTACT_STATUSES.join(", ")}`),
  body("remarks").optional({ nullable: true }).trim().isLength({ max: 2000 }),
];

export const listContactValidation = [
  query("status").optional().isIn(CONTACT_STATUSES),
  query("page").optional().isInt({ min: 1 }),
  query("pageSize").optional().isInt({ min: 1, max: 100 }),
];

export default { createContactValidation, updateContactStatusValidation, listContactValidation };
