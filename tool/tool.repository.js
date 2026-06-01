/**
 * Tool Repository — Data Access Layer
 *
 * Tất cả DB queries liên quan đến tool usage.
 */
const db = require('../db/db');

/**
 * Lấy gói đang hoạt động của user (join với packages để lấy max_turns và gateways)
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function findActiveUserPackage(userId) {
  const result = await db.query(
    `SELECT up.*, p.max_turns_per_day, p.gateways
     FROM n_user_packages up
     JOIN n_packages p ON p.id = up.package_id
     WHERE up.user_id = $1
       AND (p.is_lifetime = true OR up.expired_at >= NOW())
     ORDER BY up.expired_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Reset lượt dùng hàng ngày
 * @param {number} packageId
 */
async function resetDailyTurns(packageId) {
  await db.query(
    'UPDATE n_user_packages SET turns_used_today = 0, last_turn_reset = NOW() WHERE id = $1',
    [packageId]
  );
}

/**
 * Tăng lượt đã dùng hôm nay
 * @param {number} packageId
 */
async function incrementTurnsUsed(packageId) {
  await db.query(
    'UPDATE n_user_packages SET turns_used_today = COALESCE(turns_used_today, 0) + 1 WHERE id = $1',
    [packageId]
  );
}

/**
 * Ghi log usage của tool
 * @param {number} userId
 * @param {string} gateway
 * @param {string} prediction
 * @param {string} roundCode
 */
async function insertUsageLog(userId, gateway, prediction, roundCode) {
  await db.query(
    'INSERT INTO n_tool_usage_logs (user_id, gateway, prediction, round_code) VALUES ($1, $2, $3, $4)',
    [userId, gateway, prediction, roundCode]
  );
}

module.exports = {
  findActiveUserPackage,
  resetDailyTurns,
  incrementTurnsUsed,
  insertUsageLog,
};
