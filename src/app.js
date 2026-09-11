import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

import env from "./config/env.js";
import pool from "./config/db.js";
import { checkR2Connection } from "./utils/r2Storage.util.js";

import scholarshipRoutes from "./modules/scholarship/scholarship.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";

import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

app.set("trust proxy", 1);

// ============================================================
// SECURITY
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// ============================================================
// CORS
// ============================================================

const normalizeOrigin = (value) =>
  value ? String(value).trim().replace(/\/+$/, "") : value;

const allowedOrigins = [
  env.frontendUrl,
  env.adminFrontendUrl,
  "https://bondadafoundation.org",
  "https://www.bondadafoundation.org",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]
  .filter(Boolean)
  .map(normalizeOrigin);

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin(origin, callback) {
    // No Origin is normal for curl/Postman/server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (uniqueAllowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Rejected origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },

  methods: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Origin",
    "Accept",
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Type",
    "X-Application-Number",
    "X-Program-Application-Number",
  ],

  credentials: true,

  // Use 200 for preflight as requested and to keep the API
  // consistently on 2xx responses for this hosting environment.
  optionsSuccessStatus: 200,

  maxAge: 86400,
};

// Let the cors package be the single owner of CORS headers.
// Do not add a second manual CORS-header middleware: two
// implementations can disagree about Origin/Vary/credentials.
app.use(cors(corsOptions));

// Express 5 compatible global OPTIONS handling.
// No app.options("*") is used.
app.use((req, res, next) => {
  if (req.method !== "OPTIONS") {
    return next();
  }

  return res.status(200).end();
});

// ============================================================
// API RESPONSE / CACHE SAFETY
// ============================================================

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ============================================================
// LOGGING
// ============================================================

app.use(morgan("combined"));

// ============================================================
// RATE LIMIT
// ============================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

app.use("/api", apiLimiter);

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bondada Foundation API is running.",
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Bondada Foundation API is running.",
    environment: env.nodeEnv,
    buildMarker: "cors-fix-200-2026-09-10-v2",
  });
});

app.get("/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1 AS ok");
    res.status(200).json({ success: true, database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({ success: false, database: "unavailable" });
  }
});

app.get("/health/storage", async (req, res) => {
  if (env.storageDriver !== "r2") {
    return res.status(200).json({ success: true, storage: "local" });
  }

  try {
    await checkR2Connection();
    return res.status(200).json({ success: true, storage: "r2", bucketConfigured: true });
  } catch (error) {
    console.error("R2 health check failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      bucketConfigured: Boolean(env.r2.bucketName),
      credentialsConfigured: Boolean(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey),
    });
    return res.status(503).json({ success: false, storage: "r2", bucketConfigured: Boolean(env.r2.bucketName) });
  }
});

// ============================================================
// ROUTES
// ============================================================

app.use("/api/v1/scholarships", scholarshipRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/admin", adminRoutes);

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(errorMiddleware);

export default app;
