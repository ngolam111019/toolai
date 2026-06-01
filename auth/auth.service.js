/**
 * Auth Service — Business Logic Layer
 *
 * Chứa toàn bộ business logic của authentication:
 * - Login flow (kiểm tra device, trial, gia hạn)
 * - Registration flow (OTP → verify → confirm)
 * - Password reset flow
 * - Google OAuth flow
 *
 * Service KHÔNG biết về req/res. Chỉ nhận data thuần, trả về data thuần.
 * Mọi lỗi được throw qua AppError.
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const AppError = require('../src/utils/app-error');
const authRepo = require('./auth.repository');
const format = require('../utils/format');
const common = require('../utils/common');
const { sendOtpEmail, sendEmailDangKyThanhCong, sendEmailFogotPassword } = require('../utils/mailer');
const { pushNoti } = require('../utils/noti');
const { sendDiscord } = require('../utils/discordNotify');

const JWT_SECRET = process.env.JWT_SECRET;
const TRIAL_GATEWAY = 'Zon88';
const MAX_FREE_TRIAL = 3;

/**
 * Tạo JWT token
 * @param {number} userId
 * @returns {string}
 */
function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Kiểm tra và tự động gia hạn trial nếu user hết hạn nhưng chưa dùng đủ
 * @param {number} userId
 * @returns {Promise<number>} Số lượt đã dùng trial
 */
async function checkAndRenewTrialIfEligible(userId) {
  const userPackage = await authRepo.findUserPackage(userId);
  if (!userPackage) return 0;

  const usedTrial = await authRepo.countTrialUsage(userId);
  const now = format.getTodayVNDatetime();

  const isExpired = now > userPackage.expired_at;
  const hasTrialLeft = usedTrial < MAX_FREE_TRIAL;

  if (isExpired && hasTrialLeft) {
    await authRepo.renewPackage24h(userPackage.id);
  }

  return usedTrial;
}

/**
 * Tạo user mới kèm gói trial và ghi event log
 * @param {string} email
 * @param {string} passwordHash
 * @param {string} deviceId
 * @returns {Promise<number>} userId
 */
async function createUserWithTrial(email, passwordHash, deviceId) {
  const userId = await authRepo.createUser(email, passwordHash, deviceId);
  await authRepo.createTrialPackage(userId);
  await authRepo.insertUserEventLog(userId, 'ON_SIGNUP');
  return userId;
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Đăng nhập bằng email/password
 * @param {string} email
 * @param {string} password
 * @param {string} deviceId
 * @returns {Promise<{token, email, deviceId, isSub, usedTrial}>}
 */
async function login(email, password, deviceId) {
  if (!common.isValidEmail(email)) {
    throw new AppError('Email sai định dạng', 400, 'INVALID_EMAIL');
  }

  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError('Tài khoản không tồn tại. Hãy đăng ký tài khoản', 404, 'USER_NOT_FOUND');
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordMatch) {
    throw new AppError('Thông tin đăng nhập không hợp lệ', 401, 'INVALID_CREDENTIALS');
  }

  // Kiểm tra device binding
  if (user.device_id && user.device_id !== deviceId) {
    throw new AppError('Thiết bị không hợp lệ. Tài khoản đã gắn với thiết bị khác.', 403, 'DEVICE_MISMATCH');
  }

  // Kiểm tra và gia hạn trial nếu đủ điều kiện
  const usedTrial = await checkAndRenewTrialIfEligible(user.id);

  // Gắn thiết bị mới nếu chưa có
  if (!user.device_id) {
    await authRepo.updateDeviceId(user.id, deviceId);
    // Gửi notification chào mừng (non-blocking)
    pushNoti(user, {
      title: 'Bạn có 5 lượt dùng thử miễn phí',
      message: 'Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!',
      btnText: 'Thử ngay',
      screen_redirect: 'tool',
    });
  }

  const isSub = !!(user.fcm_token || user.web_push_subscription);
  const token = signToken(user.id);

  return { token, email, deviceId, isSub, usedTrial };
}

// ─── Registration Flow ────────────────────────────────────────────────────────

/**
 * Gửi OTP đăng ký tài khoản
 * @param {string} email
 */
async function requestRegistrationOtp(email) {
  if (!email) {
    throw new AppError('Email không được để trống', 400, 'MISSING_EMAIL');
  }
  if (!common.isValidEmail(email)) {
    throw new AppError('Email sai định dạng', 400, 'INVALID_EMAIL');
  }

  const existingUser = await authRepo.findPendingUser(email);
  if (existingUser) {
    throw new AppError('Email đã được đăng ký', 400, 'EMAIL_ALREADY_EXISTS');
  }

  const now = format.getTodayVNDatetime();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 phút

  await authRepo.upsertRegistrationOtp(email, otp, expiresAt, now);

  // Gửi email non-blocking (không throw nếu gửi mail fail)
  sendOtpEmail(email, otp, 'Mã xác thực tài khoản của bạn')
    .catch(err => console.error('[requestRegistrationOtp] Lỗi gửi mail:', err.message));
}

/**
 * Xác minh OTP đăng ký
 * @param {string} email
 * @param {string} otp
 */
async function verifyRegistrationOtp(email, otp) {
  if (!email || !otp) {
    throw new AppError('Thiếu email hoặc mã OTP', 400, 'MISSING_FIELDS');
  }

  const now = format.getTodayVNDatetime();
  const record = await authRepo.findValidRegistrationOtp(email, otp, now);

  if (!record) {
    throw new AppError('OTP không hợp lệ hoặc đã hết hạn', 400, 'INVALID_OTP');
  }

  await authRepo.markRegistrationOtpVerified(email);
}

/**
 * Hoàn tất đăng ký tài khoản
 * @param {string} email
 * @param {string} password
 * @param {string} deviceId
 * @returns {Promise<{token, email, deviceId, isSub, usedTrial}>}
 */
async function confirmRegistration(email, password, deviceId) {
  const existing = await authRepo.findUserByEmail(email);
  if (existing) {
    throw new AppError('Email này đã được đăng ký', 400, 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await createUserWithTrial(email, passwordHash, deviceId);

  await authRepo.deleteRegistrationOtp(email);

  const token = signToken(userId);

  // Gửi email chào mừng non-blocking
  sendEmailDangKyThanhCong(email, password)
    .catch(err => console.error('[confirmRegistration] Lỗi gửi mail:', err.message));

  return { token, email, deviceId, isSub: false, usedTrial: 0 };
}

// ─── Password Reset Flow ──────────────────────────────────────────────────────

/**
 * Gửi OTP reset mật khẩu
 * @param {string} email
 */
async function requestPasswordReset(email) {
  if (!email) {
    throw new AppError('Email không được để trống', 400, 'MISSING_EMAIL');
  }
  if (!common.isValidEmail(email)) {
    throw new AppError('Email sai định dạng', 400, 'INVALID_EMAIL');
  }

  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError('Email không tồn tại trong hệ thống', 404, 'EMAIL_NOT_FOUND');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await authRepo.upsertResetOtp(email, otp);
  await sendOtpEmail(email, otp, 'Mã OTP khôi phục mật khẩu');
}

/**
 * Xác minh OTP reset mật khẩu (5 phút hiệu lực)
 * @param {string} email
 * @param {string} otp
 */
async function verifyPasswordResetOtp(email, otp) {
  if (!email || !otp) {
    throw new AppError('Thiếu email hoặc mã OTP', 400, 'MISSING_FIELDS');
  }

  const record = await authRepo.findResetOtp(email);
  if (!record) {
    throw new AppError('Không tìm thấy OTP', 400, 'OTP_NOT_FOUND');
  }

  if (record.otp !== otp) {
    throw new AppError('Mã OTP không đúng', 400, 'INVALID_OTP');
  }

  const OTP_EXPIRY_MINUTES = 5;
  const diffMs = Date.now() - new Date(record.created_at).getTime();
  const diffMin = diffMs / 1000 / 60;
  if (diffMin > OTP_EXPIRY_MINUTES) {
    throw new AppError('Mã OTP đã hết hạn', 400, 'OTP_EXPIRED');
  }
}

/**
 * Đặt lại mật khẩu mới và gửi email
 * @param {string} email
 */
async function sendNewPassword(email) {
  if (!email) {
    throw new AppError('Thiếu email', 400, 'MISSING_EMAIL');
  }

  const record = await authRepo.findResetOtp(email);
  if (!record) {
    throw new AppError('Email chưa xác minh OTP', 400, 'OTP_NOT_VERIFIED');
  }

  const newPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await authRepo.updatePassword(email, passwordHash);
  await sendEmailFogotPassword(email, newPassword);
  await authRepo.deleteResetOtp(email);
}

// ─── Change Password ──────────────────────────────────────────────────────────

/**
 * Đổi mật khẩu
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 */
async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new AppError('Thiếu thông tin', 400, 'MISSING_FIELDS');
  }

  const user = await authRepo.findUserById(userId);
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new AppError('Mật khẩu cũ không đúng', 401, 'WRONG_PASSWORD');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await authRepo.updatePassword(user.email, newHash);
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * Đăng nhập/đăng ký qua Google OAuth
 * @param {string} idToken - Google ID token
 * @param {string} deviceId
 * @param {number} platform - 1 = web app, 0 = mobile
 * @returns {Promise<{token, email, deviceId, isSub, usedTrial}>}
 */
async function authWithGoogle(idToken, deviceId, platform) {
  // Verify Google token
  const googleClientId = platform === 1
    ? process.env.GOOGLE_CLIENT_ID_WEB_APP
    : process.env.GOOGLE_CLIENT_ID;

  const client = new OAuth2Client(googleClientId);
  const ticket = await client.verifyIdToken({ idToken, aud: googleClientId });
  const payload = ticket.getPayload();
  const email = payload.email;

  let userId;
  let isSub = false;
  let usedTrial = 0;

  const existingUser = await authRepo.findUserForOAuth(email);

  if (!existingUser) {
    // Tạo user mới qua Google
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    userId = await createUserWithTrial(email, passwordHash, deviceId);

    // Gửi email chào mừng non-blocking
    sendEmailDangKyThanhCong(email, tempPassword)
      .catch(err => console.error('[authWithGoogle] Lỗi gửi mail:', err.message));
  } else {
    userId = existingUser.id;

    // Kiểm tra device binding
    if (existingUser.device_id && existingUser.device_id !== deviceId) {
      throw new AppError('Thiết bị không hợp lệ. Tài khoản đã gắn với thiết bị khác.', 403, 'DEVICE_MISMATCH');
    }

    if (!existingUser.device_id) {
      await authRepo.updateDeviceId(userId, deviceId);
    }

    // Kiểm tra và gia hạn trial
    usedTrial = await checkAndRenewTrialIfEligible(userId);
    isSub = !!(existingUser.fcm_token || existingUser.web_push_subscription);
  }

  const token = signToken(userId);
  return { token, email, deviceId, isSub, usedTrial };
}

// ─── Token / Device ───────────────────────────────────────────────────────────

/**
 * Kiểm tra token + device hợp lệ
 * @param {string} token
 * @param {string} deviceId
 * @returns {Promise<{email, deviceId}>}
 */
async function checkToken(token, deviceId) {
  if (!token) {
    throw new AppError('Thiếu token', 401, 'MISSING_TOKEN');
  }
  if (!deviceId) {
    throw new AppError('Thiếu device_id', 401, 'MISSING_DEVICE_ID');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError('Token hết hạn hoặc không hợp lệ', 401, 'INVALID_TOKEN');
  }

  if (!decoded?.id) {
    throw new AppError('Token không hợp lệ', 401, 'INVALID_TOKEN');
  }

  const user = await authRepo.findUserById(decoded.id);
  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 404, 'USER_NOT_FOUND');
  }

  if (user.device_id && user.device_id !== deviceId) {
    throw new AppError('Thiết bị không hợp lệ', 403, 'DEVICE_MISMATCH');
  }

  return { email: user.email, deviceId: user.device_id };
}

module.exports = {
  login,
  requestRegistrationOtp,
  verifyRegistrationOtp,
  confirmRegistration,
  requestPasswordReset,
  verifyPasswordResetOtp,
  sendNewPassword,
  changePassword,
  authWithGoogle,
  checkToken,
};
