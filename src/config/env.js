import dotenv from "dotenv";

// GoDaddy production values are injected as environment variables.
// Local development can use .env; production can optionally use .env.production.
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: envFile, override: false });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "",
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "",
    refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
  },
  adminAuth: {
    maxFailedLoginAttempts: Number(process.env.ADMIN_MAX_FAILED_LOGIN_ATTEMPTS || 5),
    lockDurationMinutes: Number(process.env.ADMIN_LOCK_DURATION_MINUTES || 15),
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL || process.env.FRONTEND_URL || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "storage/scholarships",
  documentStorageRoot: process.env.DOCUMENT_STORAGE_ROOT || "scholarship_applicants_documents",
  storageDriver: process.env.STORAGE_DRIVER || "local",
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "bondada-documents",
    endpoint: process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : "",
    presignedUrlExpirySeconds: Number(process.env.R2_PRESIGNED_URL_EXPIRY_SECONDS || 600),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    loginMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  },
};

export default env;
