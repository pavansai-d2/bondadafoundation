import multer from "multer";
import path from "path";

// Both drivers buffer in memory rather than writing straight to
// disk. This is required for "local" too, not just "r2" — at the
// point multer runs, the application doesn't exist in the DB yet
// (it's created afterward), so the file can't be placed into its
// final scholarship_applicants_documents/{programId}/{programApplicationNumber}/{type}.ext
// folder until that application record exists. fileStorage.js does
// that placement for both drivers from the buffer — see processIncomingFile.
const storage = multer.memoryStorage();

// Documents: PDF or image. Photo: image only (matches docsDetails.jsx
// accept=".jpg,.jpeg,.png" for the passport photo field specifically).
const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/octet-stream",
];

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    return cb(new Error("Only PDF, JPG, JPEG and PNG files are allowed."));
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    return cb(new Error(`Invalid file type for ${file.originalname}.`));
  }

  cb(null, true);
};

export const scholarshipUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 6, // aadhaar, photo, marksMemo, incomeCertificate, bankPassbook, rationCard
  },
});