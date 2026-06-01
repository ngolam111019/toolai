/**
 * Payment Repository — Data Access Layer
 *
 * Tất cả DB queries liên quan đến payment/transactions.
 */
const db = require('../db/db');

/**
 * Tạo giao dịch mới (pending)
 * @param {number} userId
 * @param {number} amount
 * @param {string} tranId - UUID
 * @param {Date} expiredAt
 * @param {number} packageId
 */
async function createTransaction(userId, amount, tranId, expiredAt, packageId) {
  await db.query(
    `INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code, expired_at, package_id)
     VALUES ($1, $2, 'payment', 'pending', 'Nạp QR', $3, $4, $5)`,
    [userId, amount, tranId, expiredAt, packageId]
  );
}

/**
 * Tìm giao dịch pending theo ref_code (tranId)
 * @param {string} tranId
 */
async function findPendingTransaction(tranId) {
  const result = await db.query(
    `SELECT * FROM n_transactions WHERE ref_code = $1 AND type = 'payment' AND status = 'pending'`,
    [tranId]
  );
  return result.rows[0] || null;
}

/**
 * Cập nhật giao dịch thành công
 * @param {number} txId
 * @param {number} amount
 */
async function markTransactionSuccess(txId, amount) {
  await db.query(
    `UPDATE n_transactions SET status = 'success', amount = $2 WHERE id = $1`,
    [txId, amount]
  );
}

/**
 * Cập nhật giao dịch thất bại
 * @param {number} txId
 */
async function markTransactionFailed(txId) {
  await db.query(`UPDATE n_transactions SET status = 'failed' WHERE id = $1`, [txId]);
}

/**
 * Cộng xu vào tài khoản user
 * @param {number} userId
 * @param {number} amount
 */
async function creditUserBalance(userId, amount) {
  await db.query(
    `UPDATE n_users SET balance_xu = balance_xu + $1 WHERE id = $2`,
    [amount, userId]
  );
}

/**
 * Trừ xu từ tài khoản user
 * @param {number} userId
 * @param {number} amount
 */
async function debitUserBalance(userId, amount) {
  await db.query(
    `UPDATE n_users SET balance_xu = balance_xu - $1 WHERE id = $2`,
    [amount, userId]
  );
}

/**
 * Lấy số dư xu của user
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getUserBalance(userId) {
  const result = await db.query(`SELECT balance_xu FROM n_users WHERE id = $1`, [userId]);
  return result.rows[0]?.balance_xu || 0;
}

/**
 * Lấy thông tin user cho notification (platform, fcm_token, web_push_subscription)
 * @param {number} userId
 */
async function getUserForNotification(userId) {
  const result = await db.query(
    `SELECT platform, fcm_token, web_push_subscription FROM n_users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Ghi transaction bonus
 * @param {number} userId
 * @param {number} bonusAmount
 * @param {string} refCode - tranId gốc
 */
async function insertBonusTransaction(userId, bonusAmount, refCode) {
  await db.query(
    `INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code)
     VALUES ($1, $2, 'bonus', 'success', 'Tặng thêm khi nạp 2 triệu', $3)`,
    [userId, bonusAmount, refCode]
  );
}

/**
 * Tìm gói (package) theo ID
 * @param {number} packageId
 */
async function findPackageById(packageId) {
  const result = await db.query(`SELECT * FROM n_packages WHERE id = $1`, [packageId]);
  return result.rows[0] || null;
}

/**
 * Ghi transaction mua gói
 * @param {number} userId
 * @param {number} price - Âm vì là chi phí
 * @param {string} pkgName
 * @param {number} pkgId
 */
async function insertPurchaseTransaction(userId, price, pkgName, pkgId) {
  await db.query(
    `INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code)
     VALUES ($1, $2, 'purchase', 'success', $3, $4)`,
    [userId, -price, `Mua ${pkgName}`, `pkg_${pkgId}`]
  );
}

/**
 * Xóa gói cũ của user (thay thế bằng gói mới)
 * @param {number} userId
 */
async function deleteUserPackages(userId) {
  await db.query(`DELETE FROM n_user_packages WHERE user_id = $1`, [userId]);
}

/**
 * Tạo user package mới sau khi mua
 * @param {number} userId
 * @param {number} packageId
 * @param {string|Date} expiredAt - '9999-12-31' cho lifetime
 */
async function createUserPackage(userId, packageId, expiredAt) {
  await db.query(
    `INSERT INTO n_user_packages (user_id, package_id, turns_used_today, last_turn_reset, expired_at)
     VALUES ($1, $2, 0, NOW(), $3)`,
    [userId, packageId, expiredAt]
  );
}

/**
 * Ghi event log mua gói
 * @param {number} userId
 * @param {string} eventCode
 */
async function insertUserEventLog(userId, eventCode) {
  await db.query(
    `INSERT INTO n_user_event_logs (user_id, event_code) VALUES ($1, $2)`,
    [userId, eventCode]
  );
}

module.exports = {
  createTransaction,
  findPendingTransaction,
  markTransactionSuccess,
  markTransactionFailed,
  creditUserBalance,
  debitUserBalance,
  getUserBalance,
  getUserForNotification,
  insertBonusTransaction,
  findPackageById,
  insertPurchaseTransaction,
  deleteUserPackages,
  createUserPackage,
  insertUserEventLog,
};
