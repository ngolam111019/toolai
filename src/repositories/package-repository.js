/**
 * Package Repository — Data Access Layer
 */
const db = require('../config/db');

/** Lấy danh sách tất cả gói (id > 0) */
async function findAllPackages() {
  const result = await db.query(
    `SELECT id, name, price, price_2, duration_days, gateways, description, color, bg_color, is_best_saler, max_turns_per_day, is_gift
     FROM n_packages WHERE id > 0 ORDER BY id ASC`
  );
  return result.rows;
}

/** Tìm gói theo ID */
async function findPackageById(packageId) {
  const result = await db.query(`SELECT * FROM n_packages WHERE id = $1`, [packageId]);
  return result.rows[0] || null;
}

/** Lấy gói đang dùng của user (kể cả trial hết hạn) */
async function findUserPackageWithDetails(userId) {
  const result = await db.query(
    `SELECT up.*, p.name, p.max_turns_per_day, p.gateways, p.is_gift
     FROM n_user_packages up
     JOIN n_packages p ON p.id = up.package_id
     WHERE up.user_id = $1
       AND (p.is_lifetime = true OR up.package_id = 0 OR up.expired_at >= NOW())
     ORDER BY up.expired_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/** Đếm số lượt trial đã dùng */
async function countTrialUsage(userId) {
  const result = await db.query(
    `SELECT COUNT(*) AS trial_used FROM public.n_tool_usage_logs WHERE gateway = 'Zon88' AND user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0]?.trial_used || '0', 10);
}

/** Lấy số dư xu của user */
async function getUserBalance(userId) {
  const result = await db.query(`SELECT balance_xu FROM n_users WHERE id = $1`, [userId]);
  return result.rows[0]?.balance_xu || 0;
}

/** Trừ xu */
async function debitUserBalance(userId, amount) {
  await db.query(`UPDATE n_users SET balance_xu = balance_xu - $1 WHERE id = $2`, [amount, userId]);
}

/** Ghi transaction mua gói */
async function insertPurchaseTransaction(userId, price, pkgName, pkgId) {
  await db.query(
    `INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code)
     VALUES ($1, $2, 'purchase', 'success', $3, $4)`,
    [userId, -price, `Mua ${pkgName}`, `pkg_${pkgId}`]
  );
}

/** Xóa gói cũ */
async function deleteUserPackages(userId) {
  await db.query(`DELETE FROM n_user_packages WHERE user_id = $1`, [userId]);
}

/** Tạo gói mới */
async function createUserPackage(userId, packageId, expiredAt) {
  await db.query(
    `INSERT INTO n_user_packages (user_id, package_id, turns_used_today, last_turn_reset, expired_at)
     VALUES ($1, $2, 0, NOW(), $3)`,
    [userId, packageId, expiredAt]
  );
}

/** Ghi event log */
async function insertUserEventLog(userId, eventCode) {
  await db.query(
    `INSERT INTO n_user_event_logs (user_id, event_code) VALUES ($1, $2)`,
    [userId, eventCode]
  );
}

module.exports = {
  findAllPackages,
  findPackageById,
  findUserPackageWithDetails,
  countTrialUsage,
  getUserBalance,
  debitUserBalance,
  insertPurchaseTransaction,
  deleteUserPackages,
  createUserPackage,
  insertUserEventLog,
};
