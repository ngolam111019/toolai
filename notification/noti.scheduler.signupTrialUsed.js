// /notification/noti.scheduler.signupTrialUsed.js
const cron = require('node-cron');
const db = require('../db/db');
const { DateTime } = require('luxon');

async function scheduleSignupTrialUsed() {
  try {
    console.log('🔎 [SignupTrialUsed] Quét user đủ điều kiện...');

    // 1️⃣ Lấy user package=0 và trial_used >= 3
    const users = await db.query(`
      SELECT 
        u.id AS user_id,
        u.email,
        u.platform,
        p.turns_used_today AS trial_used
      FROM n_users u
      JOIN n_user_packages p ON p.user_id = u.id
      WHERE p.package_id = 0
        AND p.turns_used_today >= 3
        AND u.created_at > '2025-11-28 14:00:00'
    `);

    if (users.rowCount === 0) {
      console.log('🔍 [SignupTrialUsed] Không có user đủ điều kiện.');
      return;
    }

    console.log(`🔍 [SignupTrialUsed] ${users.rowCount} user cần xử lý.`);

    for (const user of users.rows) {

      // 2️⃣ Check xem user đã có event này hay chưa
      const existed = await db.query(`
        SELECT 1 FROM n_user_event_logs
        WHERE user_id = $1
          AND event_code = 'ON_SIGNUP_TRIAL_USED'
          AND event_time::date = NOW()::date
        LIMIT 1
      `, [user.user_id]);

      if (existed.rowCount > 0) {
        console.log(`⏩ User ${user.user_id} hôm nay đã có event ON_SIGNUP_TRIAL_USED → bỏ qua`);
        continue;
      }

      // 3️⃣ Ghi event mới
      await db.query(`
        INSERT INTO n_user_event_logs (user_id, event_code, meta)
        VALUES ($1, 'ON_SIGNUP_TRIAL_USED', jsonb_build_object('trial_used', $2::int))
      `, [user.user_id, user.trial_used]);

      console.log(`📌 [SignupTrialUsed] Ghi event mới cho user ${user.user_id}`);
    }

  } catch (err) {
    console.error('❌ [SignupTrialUsed] Lỗi:', err);
  }
}

// CRON 5 phút 1 lần
cron.schedule('* * * * *', scheduleSignupTrialUsed, {
  timezone: 'Asia/Ho_Chi_Minh',
});

module.exports = { scheduleSignupTrialUsed };