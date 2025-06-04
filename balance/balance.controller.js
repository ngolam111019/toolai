const db = require('../db/db');
const { sendDiscord } = require('../utils/discordNotify');

async function getBalanceLogs(req, res) {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(`
      SELECT amount, type, status, reason, ref_code, created_at
      FROM n_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);

    return res.json(rows);
  } catch (err) {
    console.error('[getBalanceLogs]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [getBalanceLogs]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi lấy lịch sử giao dịch Xu' });
  }
}

module.exports = {
  getBalanceLogs
};