/**
 * Tool Middleware — Access Control Layer
 *
 * Kiểm tra quyền sử dụng tool trước khi request tới controller.
 * Gắn thông tin pkg vào req.pkg để controller sử dụng.
 */
const asyncHandler = require('../utils/async-handler');
const toolService = require('../services/tool-service');

/**
 * Middleware kiểm tra lượt dùng tool còn hay không
 * Gắn req.pkg nếu còn lượt, trả 403 nếu hết lượt/hết hạn gói
 */
const checkToolUsageLimit = asyncHandler(async (req, res, next) => {
  req.pkg = await toolService.validateToolAccess(req.user.id);
  next();
});

module.exports = { checkToolUsageLimit };