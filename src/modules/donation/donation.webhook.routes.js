// Mounted in app.js at /api/v1/webhooks BEFORE express.json(), because
// the signature check needs the exact raw request bytes.

import express from "express";
import { handleRazorpayWebhook } from "./donation.webhook.controller.js";

const router = express.Router();

router.post("/razorpay", express.raw({ type: "*/*", limit: "1mb" }), handleRazorpayWebhook);

export default router;
