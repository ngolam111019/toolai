const db = require('../db/db');

exports.checkPermission = async (user_id, gateway) => {
  // Lấy gói đang active của user
  const resPkg = await db.query(`
    SELECT up.*, p.max_turns_per_day, p.duration_days, p.is_lifetime, p.gateways, p.id AS pkg_id
    FROM n_user_packages up
    JOIN n_packages p ON up.package_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.activated_at DESC
    LIMIT 1
  `, [user_id]);

  if (!resPkg.rows.length) {
    return { allowed: false, reason: 'Bạn chưa có gói sử dụng.' };
  }

  const pkg = resPkg.rows[0];

  // Lấy ngày hôm nay (YYYY-MM-DD)
  const today = new Date('2025-05-16').toISOString().slice(0, 10);

  // Lấy ngày reset gần nhất (nếu có)
  let lastReset = null;
  if (pkg.last_turn_reset instanceof Date) {
    lastReset = pkg.last_turn_reset.toISOString().slice(0, 10);
  } else if (typeof pkg.last_turn_reset === 'string') {
    lastReset = new Date(pkg.last_turn_reset).toISOString().slice(0, 10);
  }

  // GÓI 0: Dùng thử
  if (pkg.package_id === 0) {
    // Lấy ngày đăng ký tài khoản
    const resUser = await db.query(`SELECT created_at FROM n_users WHERE id = $1`, [user_id]);
    const createdDate = new Date(resUser.rows[0].created_at).toISOString().slice(0, 10);

    if (createdDate !== today) {
      return { allowed: false, reason: 'Gói dùng thử chỉ có hiệu lực trong ngày đăng ký.' };
    }

    if (pkg.turns_used_today >= 5) {
      return { allowed: false, reason: 'Bạn đã dùng hết 5 lượt dùng thử hôm nay.' };
    }

    if (!pkg.gateways.includes(gateway)) {
      return { allowed: false, reason: `Gói dùng thử không hỗ trợ cổng ${gateway}.` };
    }

    return {
      allowed: true,
      current_package: pkg.package_id,
      turns_left: 5 - pkg.turns_used_today,
      package_row_id: pkg.id
    };
  }

  // Các gói 1–3
  // Reset lượt nếu là ngày mới (trừ gói dùng thử)
  if (lastReset !== today) {
    await db.query(`
      UPDATE n_user_packages
      SET turns_used_today = 0, last_turn_reset = CURRENT_DATE
      WHERE id = $1
    `, [pkg.id]);

    pkg.turns_used_today = 0;
    pkg.last_turn_reset = new Date(today);
  }

  // Kiểm tra lượt còn
  if (pkg.turns_used_today >= pkg.max_turns_per_day) {
    return { allowed: false, reason: 'Bạn đã dùng hết lượt chơi hôm nay.' };
  }

  // Kiểm tra hết hạn (nếu không phải lifetime)
  if (!pkg.is_lifetime && pkg.expired_at && new Date(pkg.expired_at) < new Date()) {
    return { allowed: false, reason: 'Gói của bạn đã hết hạn.' };
  }

  // Kiểm tra cổng game
  if (!pkg.gateways.includes(gateway)) {
    return { allowed: false, reason: `Gói hiện tại không hỗ trợ cổng ${gateway}.` };
  }

  return {
    allowed: true,
    current_package: pkg.package_id,
    turns_left: pkg.max_turns_per_day - pkg.turns_used_today,
    package_row_id: pkg.id
  };
};