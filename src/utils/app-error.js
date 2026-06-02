/**
 * AppError — Custom operational error class
 *
 * Phân biệt operational errors (lỗi dự kiến, như 404, 403)
 * với programmer errors (bugs không mong đợi).
 *
 * @example
 *   throw new AppError('User not found', 404, 'USER_NOT_FOUND');
 *   throw new AppError('Access denied', 403, 'ACCESS_DENIED');
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} code - Machine-readable error code (default: 'INTERNAL_ERROR')
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Dùng để phân biệt với programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
