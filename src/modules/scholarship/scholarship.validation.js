import { SCHOLARSHIP_CODES } from "./scholarship.constants.js";

const required = (object, field, label, errors) => {
    if (object[field] === undefined || object[field] === null || String(object[field]).trim() === "") {
        errors.push(`${label} is required.`);
    }
};

// ============================================================
// APPLICATION VALIDATION
//
// Mirrors the frontend's per-step validation (ScholarshipForm.jsx)
// for the stable, always-present fields (personal/family/bank).
//
// Academic details are intentionally NOT validated field-by-field
// here — academicFields is fully data-driven in the frontend's
// scholarshipConfig.js, and hardcoding every field name here would
// mean this file breaks every time that config changes. Instead we
// just require `academic` to be a non-empty object with no blank
// values, which is a generic completeness check that survives
// config changes without code edits.
// ============================================================

export const validateScholarshipApplication = (data, files = {}) => {
    const errors = [];

    const validCodes = Object.values(SCHOLARSHIP_CODES);

    if (!validCodes.includes(data.scholarshipCode)) {
        errors.push("Valid scholarshipCode is required.");
    }

    // Personal
    required(data, "fullName", "Full name", errors);
    required(data, "dob", "Date of birth", errors);
    required(data, "aadhar", "Aadhaar number", errors);
    required(data, "mobile", "Mobile number", errors);
    required(data, "email", "Email address", errors);

    if (data.aadhar && !/^\d{12}$/.test(String(data.aadhar))) {
        errors.push("Aadhaar number must contain exactly 12 digits.");
    }

    if (data.mobile && !/^[6-9]\d{9}$/.test(String(data.mobile))) {
        errors.push("Mobile number must contain exactly 10 digits.");
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
        errors.push("A valid email address is required.");
    }

    // Bondada employee referral
    if (data.referredByBondadaEmployee === undefined || data.referredByBondadaEmployee === null) {
        errors.push("Please indicate whether you were referred by a Bondada employee.");
    }

    if (data.referredByBondadaEmployee === true || data.referredByBondadaEmployee === "true") {
        required(data, "employeeName", "Employee name", errors);
        required(data, "employeeId", "Employee ID", errors);
    }

    // Family
    required(data, "parentName", "Parent/Guardian name", errors);
    required(data, "parentAadhar", "Parent/Guardian Aadhaar number", errors);
    required(data, "parentMobile", "Parent/Guardian mobile number", errors);
    required(data, "occupation", "Occupation", errors);
    required(data, "annualIncome", "Annual family income", errors);
    required(data, "rationCardType", "Ration card type", errors);
    required(data, "rationCardNumber", "Ration card number", errors);
    required(data, "presentAddress", "Present address", errors);

    if (data.previouslyApplied === true || data.previouslyApplied === "true") {
        if (!data.previousAppliedYear) {
            errors.push("Previous application year is required.");
        }
    }

    // Bank
    required(data, "accountHolder", "Bank account holder name", errors);
    required(data, "bankName", "Bank name", errors);
    required(data, "accountNumber", "Account number", errors);
    required(data, "confirmAccountNumber", "Confirm account number", errors);
    required(data, "ifsc", "IFSC code", errors);
    required(data, "branchName", "Branch name", errors);

    if (
        data.accountNumber &&
        data.confirmAccountNumber &&
        String(data.accountNumber) !== String(data.confirmAccountNumber)
    ) {
        errors.push("Bank account numbers do not match.");
    }

    if (data.ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(String(data.ifsc).toUpperCase())) {
        errors.push("Invalid IFSC code.");
    }

    // Academic — generic completeness check (see comment above)
    const academic = data.academic || {};

    if (typeof academic !== "object" || Array.isArray(academic) || Object.keys(academic).length === 0) {
        errors.push("Academic details are required.");
    } else {
        for (const [key, value] of Object.entries(academic)) {
            if (value === undefined || value === null || String(value).trim() === "") {
                errors.push(`Academic field "${key}" cannot be blank.`);
            }
        }
    }

    // Documents — 6 required, matching docsDetails.jsx
    const requiredDocuments = [
        "aadharFile",
        "photoFile",
        "marksFile",
        "incomeCertificate",
        "bankPassbook",
        "rationCardFile",
    ];

    for (const documentField of requiredDocuments) {
        if (!files[documentField] || !files[documentField][0]) {
            errors.push(`${documentField} document is required.`);
        }
    }

    return errors;
};

export default { validateScholarshipApplication };
