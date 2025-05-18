const db = require('../db/db');

async function checkToolUsageLimit(req, res, next) {
  try {
    const userId = req.user.id;

    // Lấy gói hiện tại
    const { rows } = await db.query(`
      SELECT up.*, p.max_turns_per_day, p.gateways
      FROM n_user_packages up
      JOIN n_packages p ON p.id = up.package_id
      WHERE up.user_id = $1
        AND (p.is_lifetime = true OR up.expired_at >= NOW())
      ORDER BY up.expired_at DESC
      LIMIT 1
    `, [userId]);

    if (!rows.length) {
      return res.status(403).json({ error: 'Bạn chưa có gói hợp lệ hoặc đã hết hạn' });
    }

    const pkg = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = pkg.last_turn_reset.toISOString().slice(0, 10);

    let turnsUsed = pkg.turns_used_today;

    // Nếu đã sang ngày mới → reset lượt
    if (lastReset !== today) {
      await db.query(`
        UPDATE n_user_packages
        SET turns_used_today = 0, last_turn_reset = NOW()
        WHERE id = $1
      `, [pkg.id]);
      turnsUsed = 0;
    }

    // Nếu còn lượt → cho dùng tiếp
    if (turnsUsed < pkg.max_turns_per_day) {
      req.pkg = {
        id: pkg.id,
        max_turns: pkg.max_turns_per_day,
        turns_used: turnsUsed,
        allowed_gateways: pkg.gateways  // 👈 thêm dòng này
      };
      return next();
    }

    return res.status(403).json({ error: 'Bạn đã hết lượt chơi hôm nay' });

  } catch (err) {
    console.error('[checkToolUsageLimit]', err);
    res.status(500).json({ error: 'Lỗi kiểm tra lượt chơi' });
  }
}

module.exports = {
  checkToolUsageLimit
};