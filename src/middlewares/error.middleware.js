// ============================================================
// GLOBAL ERROR MIDDLEWARE
//
// Normalizes every error thrown across the app — including
// SQLSTATE 45000 SIGNALs raised inside stored procedures
// (e.g. "Invalid status transition") — into a consistent
// { success, message, errors? } JSON shape.
// ============================================================

const isProd = () => process.env.NODE_ENV === "production";

export const errorMiddleware = (err, req, res, next) => {
  void next;

  // MySQL/MariaDB stored-procedure SIGNAL errors
  // (SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '...')
  // arrive as err.sqlState === '45000' with a human-readable
  // err.sqlMessage. Treat as a client error unless a specific
  // handler already set a statusCode.
  if (!err.statusCode && err.sqlState === "45000") {
    err.statusCode = 400;
    err.message = err.sqlMessage || err.message;
  }

  if (!err.statusCode && err.code === "ER_DUP_ENTRY") {
    err.statusCode = 409;
    err.message = "A record with this value already exists.";
  }

  if (!err.statusCode && err.code === "ER_ROW_IS_REFERENCED_2") {
    err.statusCode = 409;
    err.message = "This record cannot be modified because related records depend on it.";
  }

  if (!err.statusCode && err.name === "MulterError") {
    err.statusCode = 400;
  }

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("API Error:", err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error.",
    ...(err.details ? { errors: err.details } : {}),
    ...(!isProd() && statusCode >= 500 ? { stack: err.stack } : {}),
  });
};

export default errorMiddleware;
