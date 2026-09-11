import express from "express";
import rateLimit from "express-rate-limit";

import { create, list, getById, updateStatus, remove } from "./contact.controller.js";
import { createContactValidation, updateContactStatusValidation, listContactValidation } from "./contact.validation.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import env from "../../config/env.js";

const router = express.Router();

// Public contact form is a common spam/abuse target — its own limiter.
const contactLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many messages sent. Please try again later." },
});

// =====================================================
// PUBLIC
// =====================================================

router.post("/", contactLimiter, createContactValidation, validate, create);

// =====================================================
// ADMIN — permission-gated (contact.view / contact.respond / contact.delete)
// =====================================================

router.get("/", authenticate, requirePermission("contact.view"), listContactValidation, validate, list);
router.get("/:id", authenticate, requirePermission("contact.view"), getById);
router.patch(
  "/:id/status",
  authenticate,
  requirePermission("contact.respond"),
  updateContactStatusValidation,
  validate,
  updateStatus
);
router.delete("/:id", authenticate, requirePermission("contact.delete"), remove);

export default router;
