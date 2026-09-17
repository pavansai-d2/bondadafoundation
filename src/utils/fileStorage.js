// ============================================================
// FILE STORAGE ABSTRACTION
//
// Single entry point the rest of the app uses for document
// storage, regardless of driver (local disk in dev, Cloudflare
// R2 in prod). Controlled by env.storageDriver ("local" | "r2").
//
// Both drivers use the SAME folder-per-applicant structure:
//   applications/{scholarshipCode}/{applicationId}/{documentType}{ext}
// so a document's location is never ambiguous about which
// applicant it belongs to, in dev or in production.
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import env from "../config/env.js";
import {
  buildObjectKey,
  uploadToR2,
  getObjectStream,
  deleteFromR2,
  objectExistsInR2,
} from "./r2Storage.util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

export const scholarshipStoragePath = path.join(backendRoot, "storage", "scholarships");

const isR2 = () => env.storageDriver === "r2";

// ============================================================
// PROCESS AN INCOMING UPLOAD
//
// Both drivers receive the file as a buffer (multer.memoryStorage)
// and place it under applications/{scholarshipCode}/{applicationId}/{documentType}{ext}
// — locally on disk, or as an R2 object key.
// ============================================================

export const processIncomingFile = async (file, { scholarshipProgramId, programApplicationNumber, documentType }) => {
  const relativeKey = buildObjectKey(scholarshipProgramId, programApplicationNumber, documentType, file.originalname);

  if (isR2()) {
    await uploadToR2(relativeKey, file.buffer, file.mimetype);

    return {
      originalname: file.originalname,
      filename: relativeKey, // stored_name
      path: relativeKey, // file_path — the R2 object key itself
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  // Local: write the buffer under the same relative path structure,
  // creating the applicant's subfolder as needed.
  const absolutePath = path.join(scholarshipStoragePath, relativeKey);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, file.buffer);

  return {
    originalname: file.originalname,
    filename: relativeKey, // stored_name — same relative-path convention as R2
    path: relativeKey, // file_path — relative to scholarshipStoragePath
    mimetype: file.mimetype,
    size: file.size,
  };
};

// Resolves a document's stored_name/file_path (a relative key like
// "applications/apj/42/aadhaar.pdf") to an absolute local path.
export const getScholarshipDocumentPath = (storedName) => {
  return path.join(scholarshipStoragePath, storedName);
};

export const scholarshipDocumentExists = async (document) => {
  if (isR2()) {
    return await objectExistsInR2(document.file_path);
  }
  return fs.existsSync(getScholarshipDocumentPath(document.stored_name));
};

export const resolveDocumentAccess = async (document, { download = false } = {}) => {
  if (isR2()) {
    // Proxy the object through this backend rather than redirecting
    // the browser to a presigned R2 URL — see the comment on
    // getObjectStream() in r2Storage.util.js for why (R2-bucket CORS).
    const { stream, contentType, contentLength } = await getObjectStream(document.file_path);

    return {
      type: "stream",
      stream,
      contentType: contentType || document.mime_type || null,
      contentLength,
    };
  }
  return { type: "path", value: getScholarshipDocumentPath(document.stored_name) };
};

export const deleteStoredDocument = async (document) => {
  if (isR2()) {
    await deleteFromR2(document.file_path);
    return;
  }
  const filePath = getScholarshipDocumentPath(document.stored_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};