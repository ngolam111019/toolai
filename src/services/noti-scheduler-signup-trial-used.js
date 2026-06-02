// /notification/noti.scheduler.signupTrialUsed.js
const cron = require('node-cron');
const db = require('../config/db');
const { DateTime } = require('luxon');

async function scheduleSignupTrialUsed() {
  try {
    console.log('🔎 [SignupTrialUsed] Quét user đủ điều kiện...');

    // 1️⃣ Lấy user package=0 và trial_used >= 3
    const users = await db.query(`
      WITH latest_event AS (
          SELECT 
              user_id,
              event_code,
              event_time,
              ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_time DESC) AS rn
          FROM n_user_event_logs
      )
      SELECT 
          u.id AS user_id,
          u.email,
          u.platform,
          p.turns_used_today AS trial_used
      FROM n_users u
      JOIN n_user_packages p ON p.user_id = u.id
      LEFT JOIN latest_event le ON le.user_id = u.id AND le.rn = 1
      WHERE 
          p.package_id = 0
          AND p.turns_used_today >= 3
          AND u.created_at > '2025-11-28 14:00:00'
          AND NOT EXISTS (
              SELECT 1 FROM n_notifications_queue q
              WHERE q.user_id = u.id AND q.trigger_event = le.event_code
          )
    `);

    if (users.rowCount === 0) {
      console.log('🔍 [SignupTrialUsed] Không có user đủ điều kiện.');
      return;
    }

    console.log(`🔍 [SignupTrialUsed] ${users.rowCount} user cần xử lý.`);

    for (const user of users.rows) {

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