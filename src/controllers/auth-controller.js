/**
 * Auth Controller — Thin Request/Response Layer
 *
 * Nhiệm vụ DUY NHẤT:
 * 1. Lấy data từ request (req.body, req.headers, req.user)
 * 2. Gọi service
 * 3. Format response
 *
 * KHÔNG chứa business logic.
 * KHÔNG trực tiếp gọi DB.
 * Mọi lỗi được xử lý bởi asyncHandler + global errorHandler.
 */
const authService = require('../services/auth-service');
const asyncHandler = require('../utils/async-handler');

/**
 * POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, device_id } = req.body;
  const result = await authService.login(email, password, device_id);
  res.json({ message: 'Đăng nhập thành công', ...result });
});

/**
 * POST /api/auth/request-otp  (đăng ký tài khoản)
 */
exports.requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.requestRegistrationOtp(email);
  res.json({ message: 'OTP đã được gửi tới email của bạn' });
});

/**
 * POST /api/auth/verify-otp  (đăng ký tài khoản)
 */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  await authService.verifyRegistrationOtp(email, otp);
  res.json({ message: 'Xác minh OTP thành công' });
});

/**
 * POST /api/auth/confirm-register
 */
exports.confirmRegister = asyncHandler(async (req, res) => {
  const { email, password, device_id } = req.body;
  const result = await authService.confirmRegistration(email, password, device_id);
  res.status(201).json({ message: 'Đăng ký tài khoản thành công', ...result });
});

/**
 * POST /api/auth/request-reset  (quên mật khẩu)
 */
exports.requestReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.requestPasswordReset(email);
  res.json({ message: 'OTP đã được gửi về email' });
});

/**
 * POST /api/auth/verify-reset-otp
 */
exports.verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  await authService.verifyPasswordResetOtp(email, otp);
  res.json({ message: 'Xác minh OTP thành công' });
});

/**
 * POST /api/auth/send-new-password
 */
exports.sendNewPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.sendNewPassword(email);
  res.json({ message: 'Mật khẩu mới đã được gửi về email' });
});

/**
 * POST /api/auth/change-password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ message: 'Đổi mật khẩu thành công' });
});

/**
 * POST /api/auth/fcm-token
 */
exports.fcmToken = asyncHandler(async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) {
    const AppError = require('../utils/app-error');
    throw new AppError('Thiếu thông tin', 400, 'MISSING_FCM_TOKEN');
  }
  const authRepo = require('../repositories/auth-repository');
  await authRepo.updateFcmToken(req.user.id, fcm_token);
  req.user.fcm_token = fcm_token;
  res.json({ message: 'Cập nhật fcm_token thành công' });
});

/**
 * POST /api/auth/auth-google
 */
exports.authGoogle = asyncHandler(async (req, res) => {
  const { idToken, deviceId, platform } = req.body;
  const result = await authService.authWithGoogle(idToken, deviceId, platform);
  res.json({ message: 'Đăng nhập thành công', ...result });
});

/**
 * POST /api/auth/save-web-subscription
 */
exports.saveWebSubscription = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  const authRepo = require('../repositories/auth-repository');
  await authRepo.updateWebPushSubscription(req.user.id, subscription, 1);
  req.user.web_push_subscription = subscription;
  req.user.platform = 1;
  res.json({ success: true });
});

/**
 * GET /api/auth/check-token
 */
exports.checkToken = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const deviceId = req.headers['x-device-id'];
  const result = await authService.checkToken(token, deviceId);
  res.json({ valid: true, message: 'Token hợp lệ', ...result });
});