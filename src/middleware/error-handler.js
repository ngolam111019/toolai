const AppError = require('../utils/app-error');
const { sendDiscord } = require('../utils/discord-notify');

/**
 * Global Express Error Handler
 *
 * Xử lý tập trung tất cả lỗi từ:
 * - asyncHandler (lỗi async route handlers)
 * - next(err) calls
 * - AppError thrown anywhere
 *
 * Phân biệt:
 * - Operational errors (AppError.isOperational = true): trả message cụ thể cho client
 * - Programmer errors (bugs): ẩn chi tiết, chỉ trả generic message
 */
function errorHandler(err, req, res, next) {
  // Mặc định là 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  // Log tất cả errors (kể cả operational) để debug
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    message: err.message,
    code: err.code,
    statusCode,
    stack: err.stack,
  });

  // Gửi Discord alert cho server errors (5xx)
  if (statusCode >= 500) {
    sendDiscord(
      'error',
      `🚨 Lỗi hệ thống [${req.method} ${req.url}]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`
    ).catch(() => {}); // Không để lỗi Discord làm crash server
  }

  // Với programmer errors (không phải AppError): ẩn chi tiết khỏi client
  if (!isOperational) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      },
    });
  }

  // Với operational errors: trả thông tin cụ thể cho client
  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code,
      message: err.message,
    },
  });
}

/**
 * 404 Not Found Handler — đặt trước errorHandler
 */
function notFoundHandler(req, res, next) {
  const err = new AppError(`Route không tồn tại: ${req.method} ${req.url}`, 404, 'ROUTE_NOT_FOUND');
  next(err);
}

module.exports = { errorHandler, notFoundHandler };
