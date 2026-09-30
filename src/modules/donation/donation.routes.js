// ============================================================
// DONATION ROUTES
// Mount at: /api/v1/donations  (already added in app.js)
// ============================================================

import express from "express";
import { sendDonationReceipt } from "./donation.receipt.controller.js";

const router = express.Router();

// POST /api/v1/donations/receipt
// Public — called by the Donations page after payment completes.
router.post("/receipt", sendDonationReceipt);

export default router;
