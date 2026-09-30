// ============================================================
// SCHOLARSHIP CONSTANTS
// Matches scholarshipConfig.js keys in the frontend exactly.
// ============================================================

export const SCHOLARSHIP_CODES = {
    DGK_SSC: "dgk-ssc",
    DGK_INTERMEDIATE: "dgk-intermediate",
    DIPLOMA: "diploma",          // ← NEW: Diploma scholarship
    SRK: "srk",
    APJ: "apj",
    VIDYA_ASARA: "vidya-asara",
};

// Simplified linear workflow (no correction/resubmission cycle,
// no waitlist, no cancel):
// applied -> under_review -> eligible/not_eligible
// eligible -> approved -> disbursed
// not_eligible -> rejected
export const APPLICATION_STATUS = {
    APPLIED: "applied",
    UNDER_REVIEW: "under_review",
    ELIGIBLE: "eligible",
    NOT_ELIGIBLE: "not_eligible",
    APPROVED: "approved",
    REJECTED: "rejected",
    DISBURSED: "disbursed",
};

// Statuses that trigger a student notification email
// (approved/rejected are the final decision statuses Kumar Sir requested)
export const EMAIL_NOTIFICATION_STATUSES = ["approved", "rejected"];

// Matches docsDetails.jsx upload fields exactly.
export const DOCUMENT_TYPES = {
    AADHAAR: "aadhaar",
    PHOTO: "photo",
    MARKS_MEMO: "marks_memo",
    INCOME_CERTIFICATE: "income_certificate",
    BANK_PASSBOOK: "bank_passbook",
    RATION_CARD: "ration_card",
};

// Maps multer field names (from ScholarshipForm's file inputs) to
// the DOCUMENT_TYPES codes stored in the database.
export const DOCUMENT_FIELD_MAP = {
    aadharFile: DOCUMENT_TYPES.AADHAAR,
    photoFile: DOCUMENT_TYPES.PHOTO,
    marksFile: DOCUMENT_TYPES.MARKS_MEMO,
    incomeCertificate: DOCUMENT_TYPES.INCOME_CERTIFICATE,
    bankPassbook: DOCUMENT_TYPES.BANK_PASSBOOK,
    rationCardFile: DOCUMENT_TYPES.RATION_CARD,
};
