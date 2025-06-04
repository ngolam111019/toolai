const db = require('../db/db');
const format = require('../utils/format');
const { sendDiscord } = require('../utils/discordNotify');

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
      return res.status(403).json({ message: 'Gói đã hết hạn, vui lòng nâng cấp để sử dụng tiếp' });
    }

    const pkg = rows[0];
    
    const today = format.getTodayISO_VN().slice(0, 10);
    var lastReset = pkg.last_turn_reset;
    if (!lastReset) {
      // Nếu lần đầu chưa có thì xem như chưa dùng hôm nay
      lastReset = today;
    } else {
      lastReset = new Date(lastReset).toISOString().slice(0, 10);
    }
    console.log("lastReset2: " + lastReset);
    let turnsUsed = pkg.turns_used_today;
    console.log(lastReset);
    console.log(today);
    console.log(pkg.id);
    console.log(pkg.id !== 0);
    
    if(pkg.id !== 0){
      // Nếu đã sang ngày mới → reset lượt
      if (lastReset !== today) {
      console.log("reset");
        await db.query(`
          UPDATE n_user_packages
          SET turns_used_today = 0, last_turn_reset = NOW()
          WHERE id = $1
        `, [pkg.id]);
        turnsUsed = 0;
      }
    }
    else if(pkg.id === 0 && turnsUsed === pkg.max_turns_per_day) {
      return res.status(403).json({ message: 'Bạn đã dùng hết ' + pkg.max_turns_per_day + ' lượt dùng thử. Vui lòng nâng cấp để sử dụng tiếp.' });
    }

    console.log((turnsUsed < pkg.max_turns_per_day));
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

    return res.status(403).json({ message: 'Bạn đã hết lượt chơi hôm nay' });

  } catch (err) {
    console.error('[checkToolUsageLimit]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [checkToolUsageLimit]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi kiểm tra lượt chơi' });
  }
}

module.exports = {
  checkToolUsageLimit
};