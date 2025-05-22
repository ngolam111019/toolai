const db = require('../db/db');
const jwt = require('jsonwebtoken');

const PACKAGE_PRICES = {
  1: 1499000,
  2: 1999000,
  3: 9999000
};

async function upgradePackage(req, res) {
  try {
    const userId = req.user.id;
    const { package_id } = req.body;

    // B1: Lấy gói cần nâng cấp
    const { rows } = await db.query(`SELECT * FROM n_packages WHERE id = $1`, [package_id]);
    if (!rows.length) return res.status(400).json({ error: 'Gói không tồn tại' });

    const pkg = rows[0];
    const price = pkg.price;
    const isLifetime = pkg.is_lifetime;
    const duration = pkg.duration_days;

    // B2: Lấy số dư user
    const userRes = await db.query(`SELECT balance_xu FROM n_users WHERE id = $1`, [userId]);
    const currentBalance = userRes.rows[0]?.balance_xu || 0;

    if (currentBalance < price) {
      return res.status(400).json({ error: 'Không đủ Xu để nâng cấp' });
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

    console.log(userId);
    return res.json({
      success: true,
      message: 'Nâng cấp thành công',
      package_name: pkg.name,
      expired_at: expiredAt
    });

  } catch (err) {
    console.error('[upgradePackage]', err);
    res.status(500).json({ error: 'Lỗi nâng cấp gói' });
  }
}

async function getPackageStatus(req, res) {
  try {
    const userId = req.user.id;

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
    
  let expiredMessage = '';
  let expiredAt = null;


    if (!rows.length) {
      return res.json({
        package: {
          id: 0,
          name: 'Chưa có gói hoặc đã hết hạn',
          max_turns_per_day: 0,
          turns_used_today: 0,
          expired_at: null,
          gateways:[]
        },
        xu: req.user.balance_xu || 0,
        email: req.user.email
      });
    }
    else{
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
    });

  } catch (err) {
    console.error('[getPackageStatus] error:', err);
    res.status(500).json({ error: 'Lỗi lấy trạng thái gói' });
  }
}

module.exports = {
  upgradePackage,
  getPackageStatus
};