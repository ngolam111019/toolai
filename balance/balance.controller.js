const db = require('../db/db');

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
    res.status(500).json({ error: 'Lỗi lấy lịch sử giao dịch Xu' });
  }
}

module.exports = {
  getBalanceLogs
};