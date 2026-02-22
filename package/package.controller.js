const db = require('../db/db');
const format = require('../utils/format');
const { sendDiscord } = require('../utils/discordNotify');

async function getPackages(req, res) {
  try {
    const result = await db.query(`
      SELECT id, name, price, price_2, duration_days, gateways, description, color, bg_color, is_best_saler, max_turns_per_day, is_gift
      FROM n_packages
      WHERE id > 0
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách gói:', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [getPackages]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ error: 'Lỗi server' });
  }
}

async function upgradePackage(req, res) {
  try {
    const userId = req.user.id;
    const { package_id } = req.body;

    // B1: Lấy gói cần nâng cấp
    const { rows } = await db.query(`SELECT * FROM n_packages WHERE id = $1`, [package_id]);
    if (!rows.length) return res.status(400).json({ message: 'Gói không tồn tại' });

    const pkg = rows[0];

    if (package_id && package_id == 1) {
      return res.json({
        success: false,
        message: '❌ Nâng cấp KHÔNG thành công ' + pkg.name + ' (Đã đủ suất). Vui lòng chọn gói khác.'
      });
    }
    else {

      const price = pkg.price;
      const isLifetime = pkg.is_lifetime;
      const duration = pkg.duration_days;

      // B2: Lấy số dư user
      const userRes = await db.query(`SELECT balance_xu FROM n_users WHERE id = $1`, [userId]);
      const currentBalance = userRes.rows[0]?.balance_xu || 0;

      if (currentBalance < price) {
        return res.status(400).json({ message: 'Không đủ Xu để nâng cấp' });
      }


      // B3: Trừ Xu
      await db.query(`UPDATE n_users SET balance_xu = balance_xu - $1 WHERE id = $2`, [price, userId]);

      // B4: Ghi log vào n_transactions
      await db.query(`
        INSERT INTO n_transactions (user_id, amount, type, status, reason, ref_code)
        VALUES ($1, $2, 'purchase', 'success', $3, $4)
      `, [userId, -price, `Mua ${pkg.name}`, `pkg_${pkg.id}`]);

      // B5: Huỷ gói cũ nếu chỉ dùng 1 gói
      await db.query(`DELETE FROM n_user_packages WHERE user_id = $1`, [userId]);

      // B6: Tính hạn dùng
      const expiredAt = isLifetime
        ? '9999-12-31'
        : new Date(Date.now() + duration * 86400 * 1000);

      // B7: Ghi bản ghi mới vào n_user_packages
      await db.query(`
        INSERT INTO n_user_packages (user_id, package_id, turns_used_today, last_turn_reset, expired_at)
        VALUES ($1, $2, 0, NOW(), $3)
      `, [userId, pkg.id, expiredAt]);

      var eventCode;
      switch (pkg.id) {
        case 1:
          eventCode = 'ON_UPGRADE_TRIAL_PRO'
          break;
        case 2:
          eventCode = 'ON_UPGRADE_PREMIUM'
          break;
        case 3:
          eventCode = 'ON_PREMIUM_PRO_INACTIVE'
          break;
        default:
          eventCode = 'ON_SIGNUP'
      }

      // ghi log
      await db.query(`
        INSERT INTO n_user_event_logs (user_id, event_code) 
        VALUES ($1, $2)
      `, [userId, eventCode]);

      var {t, d, type} = format.titleDescTypeSenDiscord(true, userId, pkg.name, parseInt(price), req.user.platform, null);
      
      sendDiscord(type, null, {
        title: t,
        description: d,
        color: 0xFFD700
      });

      return res.json({
        success: true,
        message: 'Nâng cấp thành công',
        package_name: pkg.name,
        expired_at: expiredAt
      });
    }

  } catch (err) {
    console.error('[upgradePackage]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [upgradePackage]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi nâng cấp gói' });
  }
}

async function getPackageStatus(req, res) {
  try {
    const userId = req.user.id;


    let expiredMessage = '';
    let expiredAt = null;
    let trial_used = 0, is_used_trial = false;
    // Lấy gói đang sử dụng (gói còn hạn)
    const { rows } = await db.query(`
      SELECT up.*, p.name, p.max_turns_per_day, p.gateways
      FROM n_user_packages up
      JOIN n_packages p ON p.id = up.package_id
      WHERE up.user_id = $1
        AND (p.is_lifetime = true OR up.package_id = 0 OR up.expired_at >= NOW())
      ORDER BY up.expired_at DESC
      LIMIT 1
    `, [userId]);

    const n_tool_usage_logs = await db.query(`
      SELECT COUNT (*) trial_used
      FROM public.n_tool_usage_logs
      WHERE gateway = 'Zon88' and user_id = $1
      GROUP BY user_id
      LIMIT 1
    `, [userId]);

    if (n_tool_usage_logs.rows.length > 0) {
      const usage_log = n_tool_usage_logs.rows[0];
      trial_used = usage_log.trial_used;
      is_used_trial = true;
    }

    if (!rows.length) {
      return res.json({
        package: {
          id: 0,
          name: 'Chưa có gói hoặc đã hết hạn',
          max_turns_per_day: 0,
          turns_used_today: 0,
          expired_at: null,
          gateways: []
        },
        xu: req.user.balance_xu || 0,
        email: req.user.email,
        is_used_trial,
        trial_used
      });
    }
    else {
      const last = rows[0];
      expiredAt = last.expired_at;
      expiredMessage = `Đã hết hạn vào ngày ${new Date(expiredAt).toLocaleDateString('vi-VN')}`;
    }

    const row = rows[0];

    console.log(row);

    return res.json({
      package: {
        id: row.package_id,
        name: row.name,
        max_turns_per_day: row.max_turns_per_day,
        turns_used_today: row.turns_used_today,
        expired_at: row.expired_at,
        gateways: row.gateways,
        is_gift: row.is_gift
      },
      xu: req.user.balance_xu | 0,
      email: req.user.email,
      is_used_trial,
      trial_used
    });

  } catch (err) {
    console.error('[getPackageStatus] error:', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [getPackageStatus]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi lấy trạng thái gói' });
  }
}

module.exports = {
  getPackages,
  upgradePackage,
  getPackageStatus
};