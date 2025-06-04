const db = require('../db/db');
const { sendDiscord } = require('../utils/discordNotify');

async function getUsageLogs(req, res) {
  try {
      const userId = req.user.id;
  
      const { rows } = await db.query(`
        SELECT gateway, round_code, prediction,used_at
        FROM n_tool_usage_logs
        WHERE user_id = $1
        ORDER BY used_at DESC
        LIMIT 100
      `, [userId]);
  
      return res.json(rows);
    } catch (err) {
      console.error('[getBalanceLogs]', err);
      sendDiscord('error', `🚨 Lỗi hệ thống [getBalanceLogs]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
      res.status(500).json({ error: 'Lỗi lấy lịch sử sử dụng' });
    }
}

module.exports = {
  getUsageLogs
};