import { body } from "express-validator";

export const loginValidation = [
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("password").notEmpty().withMessage("Password is required."),
];

export const refreshValidation = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required."),
];

export const createAdminValidation = [
  body("fullName").trim().notEmpty().withMessage("Full name is required."),
  body("email").trim().isEmail().withMessage("A valid email is required."),
  body("mobile").optional({ nullable: true }).trim(),
  body("roleId").isInt({ min: 1 }).withMessage("A valid role is required."),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number."),
];

export const updateAdminStatusValidation = [
  body("status")
    .isIn(["active", "inactive", "locked"])
    .withMessage("Status must be active, inactive, or locked."),
];

export default {
  loginValidation,
  refreshValidation,
  createAdminValidation,
  updateAdminStatusValidation,
};
