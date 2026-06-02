/**
 * asyncHandler — Wrapper để tự động bắt lỗi async trong Express route handlers
 *
 * Thay vì mỗi route handler phải có try/catch riêng,
 * dùng asyncHandler để tự động forward lỗi đến Express error handler.
 *
 * @example
 *   // ❌ Trước:
 *   router.get('/users', async (req, res) => {
 *     try { ... } catch (err) { res.status(500).json(...) }
 *   });
 *
 *   // ✅ Sau:
 *   router.get('/users', asyncHandler(async (req, res) => {
 *     const users = await userService.findAll();
 *     res.json({ success: true, data: users });
 *   }));
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
