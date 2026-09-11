// ============================================================
// CLOUDFLARE R2 STORAGE UTILITY
//
// R2 is S3-compatible, so this uses the standard AWS SDK v3
// clients pointed at R2's endpoint — no Cloudflare-specific SDK
// needed.
//
// Requires: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
// Requires env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//               R2_BUCKET_NAME
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import env from "../config/env.js";

let cachedClient = null;

const getClient = () => {
  if (!env.r2.accountId || !env.r2.accessKeyId || !env.r2.secretAccessKey) {
    throw new Error(
      "R2 credentials are not set (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY). " +
      "Cannot use the R2 storage driver."
    );
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto", // R2 ignores region but the SDK requires a value
      endpoint: env.r2.endpoint,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }

  return cachedClient;
};


export const checkR2Connection = async () => {
  const client = getClient();
  await client.send(new HeadBucketCommand({ Bucket: env.r2.bucketName }));
  return true;
};

// ============================================================
// OBJECT KEY CONVENTION
//
// applications/{scholarshipCode}/{applicationId}/{documentType}{ext}
//
// e.g. applications/apj/42/aadhaar.pdf
//
// This gives exactly the folder structure you asked for: grouped
// by scholarship category, then one folder per applicant id,
// containing that applicant's documents.
// ============================================================

// ============================================================
// OBJECT KEY CONVENTION
//
// {DOCUMENT_STORAGE_ROOT}/{scholarshipProgramId}/{programApplicationNumber}/{documentType}{ext}
//
// e.g. scholarship_applicants_documents/4/BF-2026-APJ-0001/aadhaar.pdf
//
// The root folder name is configurable via env.documentStorageRoot
// (DOCUMENT_STORAGE_ROOT) — never hardcoded, so changing it is a
// config edit, not a code change. Grouped by program ID, then one
// folder per applicant's program application number.
// ============================================================

export const buildObjectKey = (scholarshipProgramId, programApplicationNumber, documentType, originalName) => {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
  return `${env.documentStorageRoot}/${scholarshipProgramId}/${programApplicationNumber}/${documentType}${ext}`;
};

// ============================================================
// UPLOAD
// ============================================================

export const uploadToR2 = async (objectKey, buffer, mimeType) => {
  const client = getClient();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream",
      })
    );
    return objectKey;
  } catch (error) {
    const wrapped = new Error(
      `R2 upload failed for ${objectKey}: ${error?.message || "unknown storage error"}`
    );
    wrapped.code = error?.name || error?.code || "R2_UPLOAD_FAILED";
    wrapped.cause = error;
    wrapped.statusCode = 502;
    throw wrapped;
  }
};

// ============================================================
// DELETE
// ============================================================

export const deleteFromR2 = async (objectKey) => {
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.r2.bucketName,
      Key: objectKey,
    })
  );
};

// ============================================================
// EXISTS CHECK
// ============================================================

export const objectExistsInR2 = async (objectKey) => {
  const client = getClient();

  try {
    await client.send(new HeadObjectCommand({ Bucket: env.r2.bucketName, Key: objectKey }));
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};

// ============================================================
// SHORT-LIVED PRESIGNED URL (view or download)
//
// Every document access is time-boxed (default 10 minutes, see
// R2_PRESIGNED_URL_EXPIRY_SECONDS) rather than a permanent
// public link. Pair with an admin_audit_logs insert at the call
// site so every view/download is traceable to an admin.
// ============================================================

export const getPresignedUrl = async (objectKey, { asAttachmentFilename = null } = {}) => {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: env.r2.bucketName,
    Key: objectKey,
    ...(asAttachmentFilename
      ? { ResponseContentDisposition: `attachment; filename="${asAttachmentFilename}"` }
      : { ResponseContentDisposition: "inline" }),
  });

  return await getSignedUrl(client, command, { expiresIn: env.r2.presignedUrlExpirySeconds });
};

export default { buildObjectKey, uploadToR2, deleteFromR2, objectExistsInR2, getPresignedUrl };