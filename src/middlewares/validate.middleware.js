// ============================================================
// VALIDATION MIDDLEWARE
//
// Runs express-validator chains and returns a consistent 422
// response shape when validation fails. Usage:
//
//   router.post("/x", [body("email").isEmail()], validate, controller)
// ============================================================

import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const error = new Error("Validation failed.");
  error.statusCode = 422;
  error.details = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));

  next(error);
};

export default validate;
