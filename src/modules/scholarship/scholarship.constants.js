// ============================================================
// SCHOLARSHIP CONSTANTS
// Matches scholarshipConfig.js keys in the frontend exactly.
// ============================================================

export const SCHOLARSHIP_CODES = {
    DGK_SSC: "dgk-ssc",
    DGK_INTERMEDIATE: "dgk-intermediate",
    DIPLOMA: "diploma",
    SRK: "srk",
    APJ: "apj",
    VIDYA_ASARA: "vidya-asara",
};

export const APPLICATION_STATUS = {
    APPLIED: "applied",
    UNDER_REVIEW: "under_review",
    ELIGIBLE: "eligible",
    NOT_ELIGIBLE: "not_eligible",
    APPROVED: "approved",
    REJECTED: "rejected",
    DISBURSED: "disbursed",
};

// ✅ UPDATED: Send email when status changes to "approved" OR "not_eligible"
// (not_eligible = student did not qualify, approved = student selected)
export const EMAIL_NOTIFICATION_STATUSES = ["approved", "not_eligible"];

export const DOCUMENT_TYPES = {
    AADHAAR: "aadhaar",
    PHOTO: "photo",
    MARKS_MEMO: "marks_memo",
    INCOME_CERTIFICATE: "income_certificate",
    BANK_PASSBOOK: "bank_passbook",
    RATION_CARD: "ration_card",
};

export const DOCUMENT_FIELD_MAP = {
    aadharFile: DOCUMENT_TYPES.AADHAAR,
    photoFile: DOCUMENT_TYPES.PHOTO,
    marksFile: DOCUMENT_TYPES.MARKS_MEMO,
    incomeCertificate: DOCUMENT_TYPES.INCOME_CERTIFICATE,
    bankPassbook: DOCUMENT_TYPES.BANK_PASSBOOK,
    rationCardFile: DOCUMENT_TYPES.RATION_CARD,
};
