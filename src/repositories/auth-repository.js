/**
 * Auth Repository — Data Access Layer
 *
 * Chỉ chứa raw DB queries liên quan đến auth/user.
 * Không chứa business logic.
 * Controller và Service không được gọi db trực tiếp.
 */
const db = require('../config/db');

/**
 * Tìm user theo email
 * @param {string} email
 * @returns {Promise<object|null>} User object hoặc null
 */
async function findUserByEmail(email) {
  const result = await db.query('SELECT * FROM n_users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

/**
 * Tìm user theo ID
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function findUserById(userId) {
  const result = await db.query('SELECT * FROM n_users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

/**
 * Tìm user theo email — chỉ lấy fields cần cho OAuth check
 * @param {string} email
 */
async function findUserForOAuth(email) {
  const result = await db.query(
    'SELECT id, device_id, fcm_token, web_push_subscription FROM n_users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Tạo user mới
 * @param {string} email
 * @param {string} passwordHash - Bcrypt hash
 * @param {string} deviceId
 * @returns {Promise<number>} userId mới tạo
 */
async function createUser(email, passwordHash, deviceId) {
  const result = await db.query(
    'INSERT INTO n_users (email, password_hash, device_id) VALUES ($1, $2, $3) RETURNING id',
    [email, passwordHash, deviceId]
  );
  return result.rows[0].id;
}

/**
 * Cập nhật device_id cho user
 * @param {number} userId
 * @param {string} deviceId
 */
async function updateDeviceId(userId, deviceId) {
  await db.query('UPDATE n_users SET device_id = $1 WHERE id = $2', [deviceId, userId]);
}

/**
 * Cập nhật password hash
 * @param {string} email
 * @param {string} newPasswordHash
 */
async function updatePassword(email, newPasswordHash) {
  await db.query('UPDATE n_users SET password_hash = $1 WHERE email = $2', [newPasswordHash, email]);
}

/**
 * Cập nhật FCM token
 * @param {number} userId
 * @param {string} fcmToken
 */
async function updateFcmToken(userId, fcmToken) {
  await db.query('UPDATE n_users SET fcm_token = $1 WHERE id = $2', [fcmToken, userId]);
}

/**
 * Cập nhật web push subscription
 * @param {number} userId
 * @param {object} subscription
 * @param {number} platform
 */
async function updateWebPushSubscription(userId, subscription, platform) {
  await db.query(
    'UPDATE n_users SET web_push_subscription = $1, platform = $2 WHERE id = $3',
    [subscription, platform, userId]
  );
}

// ─── OTP (đăng ký tài khoản) ───────────────────────────────

/**
 * Tìm user pending theo email
 * @param {string} email
 */
async function findPendingUser(email) {
  const result = await db.query('SELECT id FROM n_users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

/**
 * Upsert OTP cho đăng ký tài khoản
 * @param {string} email
 * @param {string} otp
 * @param {Date} expiresAt
 * @param {Date} now
 */
async function upsertRegistrationOtp(email, otp, expiresAt, now) {
  await db.query(
    `INSERT INTO n_user_pending (email, otp, expires_at, verified, created_at)
     VALUES ($1, $2, $3, false, $4)
     ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, created_at = $4, verified = false`,
    [email, otp, expiresAt, now]
  );
}

/**
 * Tìm OTP hợp lệ (chưa hết hạn) cho đăng ký
 * @param {string} email
 * @param {string} otp
 * @param {Date} now
 */
async function findValidRegistrationOtp(email, otp, now) {
  const result = await db.query(
    'SELECT * FROM n_user_pending WHERE email = $1 AND otp = $2 AND expires_at >= $3',
    [email, otp, now]
  );
  return result.rows[0] || null;
}

/**
 * Đánh dấu OTP đăng ký đã xác minh
 * @param {string} email
 */
async function markRegistrationOtpVerified(email) {
  await db.query('UPDATE n_user_pending SET verified = true WHERE email = $1', [email]);
}

/**
 * Xóa OTP đăng ký sau khi hoàn tất
 * @param {string} email
 */
async function deleteRegistrationOtp(email) {
  await db.query('DELETE FROM n_user_pending WHERE email = $1', [email]);
}

// ─── OTP (reset mật khẩu) ───────────────────────────────────

/**
 * Upsert OTP reset mật khẩu
 * @param {string} email
 * @param {string} otp
 */
async function upsertResetOtp(email, otp) {
  await db.query(
    `INSERT INTO n_reset_otps (email, otp, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (email) DO UPDATE SET otp = $2, created_at = NOW()`,
    [email, otp]
  );
}

/**
 * Tìm OTP reset mật khẩu
 * @param {string} email
 */
async function findResetOtp(email) {
  const result = await db.query(
    'SELECT otp, created_at FROM n_reset_otps WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Xóa OTP reset mật khẩu sau khi dùng
 * @param {string} email
 */
async function deleteResetOtp(email) {
  await db.query('DELETE FROM n_reset_otps WHERE email = $1', [email]);
}

// ─── Package / Trial ────────────────────────────────────────

/**
 * Lấy package của user
 * @param {number} userId
 */
async function findUserPackage(userId) {
  const result = await db.query(
    'SELECT id, expired_at FROM n_user_packages WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Tạo gói dùng thử cho user mới (package_id = 0)
 * @param {number} userId
 */
async function createTrialPackage(userId) {
  await db.query(
    `INSERT INTO n_user_packages (user_id, package_id, activated_at, expired_at, last_turn_reset)
     VALUES ($1, 0, NOW(), NOW() + interval '24 hours', NOW())`,
    [userId]
  );
}

/**
 * Gia hạn gói thêm 24h (cho user hết hạn nhưng chưa dùng đủ trial)
 * @param {number} packageId
 */
async function renewPackage24h(packageId) {
  await db.query(
    `UPDATE n_user_packages 
     SET expired_at = NOW() + interval '24 hours', last_turn_reset = NOW()
     WHERE id = $1`,
    [packageId]
  );
}

/**
 * Đếm số lượt dùng thử (gateway = 'Zon88') của user
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function countTrialUsage(userId) {
  const result = await db.query(
    `SELECT COUNT(*) AS trial_used
     FROM public.n_tool_usage_logs
     WHERE gateway = 'Zon88' AND user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.trial_used || '0', 10);
}

// ─── Event Logs ─────────────────────────────────────────────

/**
 * Ghi event log cho user
 * @param {number} userId
 * @param {string} eventCode - Ví dụ: 'ON_SIGNUP'
 */
async function insertUserEventLog(userId, eventCode) {
  await db.query(
    'INSERT INTO n_user_event_logs (user_id, event_code) VALUES ($1, $2)',
    [userId, eventCode]
  );
}

module.exports = {
  // User CRUD
  findUserByEmail,
  findUserById,
  findUserForOAuth,
  createUser,
  updateDeviceId,
  updatePassword,
  updateFcmToken,
  updateWebPushSubscription,

  // Registration OTP
  findPendingUser,
  upsertRegistrationOtp,
  findValidRegistrationOtp,
  markRegistrationOtpVerified,
  deleteRegistrationOtp,

  // Reset Password OTP
  upsertResetOtp,
  findResetOtp,
  deleteResetOtp,

  // Package / Trial
  findUserPackage,
  createTrialPackage,
  renewPackage24h,
  countTrialUsage,

  // Event Logs
  insertUserEventLog,
};
