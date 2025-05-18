const db = require('../db/db');

async function useTool(req, res) {
  try {
    const userId = req.user.id;
    const { gateway } = req.body;

    if (!gateway) return res.status(400).json({ error: 'Thiếu tham số gateway' });
    // (0) Kiểm tra gateway có được phép theo gói không
    if (req.pkg?.allowed_gateways?.includes && !req.pkg.allowed_gateways.includes(gateway)) {
      return res.status(403).json({ error: 'Cổng này không thuộc gói bạn đang dùng' });
    }

    // (1) Giả lập kết quả tài xỉu
    const result = Math.random() < 0.5 ? 'Tài' : 'Xỉu';

    await db.query(`
      INSERT INTO n_tool_usage_logs (user_id, gateway, prediction)
      VALUES ($1, $2, $3)
    `, [userId, gateway, result]);

    // (2) Trừ lượt sau khi dùng
    const userPackageId = req.pkg?.id;
    if (userPackageId) {
      await db.query(`
        UPDATE n_user_packages
        SET turns_used_today = turns_used_today + 1
        WHERE id = $1
      `, [userPackageId]);
    }

    // (3) Trả kết quả + lượt còn lại
    const max = req.pkg?.max_turns || 0;
    const used = req.pkg?.turns_used + 1;
    const turnsLeft = max - used;

    return res.json({
      result,
      turns_left: turnsLeft
    });

  } catch (err) {
    console.error('[useTool]', err);
    res.status(500).json({ error: 'Lỗi xử lý tool' });
  }
}

module.exports = {
  useTool
};