// /notification/noti.scheduler.events.js
const cron = require('node-cron');
const db = require('../config/db');
const { DateTime } = require('luxon');

/**
 * FLOW MỚI CỦA BẠN:
 * ON_SIGNUP → ON_UPGRADE_TRIAL_PRO → ON_UPGRADE_PREMIUM → ON_PREMIUM_PRO_INACTIVE
 */

const flowGroups = {
  ON_SIGNUP: [],

  // Funnel mới: SIGNUP_TRIAL_USED huỷ toàn bộ SIGNUP cũ
  ON_SIGNUP_TRIAL_USED: ['ON_SIGNUP'],

  // Funnel dùng thử Pro
  ON_UPGRADE_TRIAL_PRO: ['ON_SIGNUP', 'ON_SIGNUP_TRIAL_USED'],

  // Funnel Premium
  ON_UPGRADE_PREMIUM: ['ON_SIGNUP', 'ON_SIGNUP_TRIAL_USED', 'ON_UPGRADE_TRIAL_PRO'],

  // Funnel Pro
  ON_PREMIUM_PRO_INACTIVE: [
    'ON_SIGNUP',
    'ON_SIGNUP_TRIAL_USED',
    'ON_UPGRADE_TRIAL_PRO',
    'ON_UPGRADE_PREMIUM'
  ]
};

async function scheduleNotificationsFromEvents() {
  try {
    console.log('[SchedulerEvents] Quét event mới…');

    const events = await db.query(`
      SELECT e.id, e.user_id, e.event_code, e.event_time, u.email, u.platform
      FROM (
        SELECT user_id, MAX(event_time) AS event_time
        FROM n_user_event_logs
        GROUP BY user_id
      ) last
      JOIN n_user_event_logs e ON e.user_id = last.user_id AND e.event_time = last.event_time
      JOIN n_users u ON u.id = e.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM n_notifications_queue q
        WHERE q.user_id = e.user_id AND q.trigger_event = e.event_code
      )
      ORDER BY e.event_time DESC
      LIMIT 100;
    `);

    if (events.rowCount === 0) {
      console.log('[SchedulerEvents] Không có event mới.');
      return;
    }

    const templates = await db.query(`
      SELECT * FROM n_notification_templates
      WHERE is_active = TRUE
    `);

    for (const ev of events.rows) {

      // 1. Hủy flow cũ theo funnel
      await cancelOldFlow(ev.user_id, ev.event_code);

      // 2. Lấy template thuộc event này
      const listTpl = templates.rows.filter(
        t => t.trigger_event === ev.event_code
      );

      // 3. Tạo queue mới cho tất cả template
      for (const tpl of listTpl) {
        const sendAfter = DateTime.fromJSDate(ev.event_time)
          .plus({ hours: tpl.delay_hours })
          .toJSDate();

        await db.query(`
          INSERT INTO n_notifications_queue
          (user_id, email, platform, title, message, btn_text, screen_redirect, send_after, template_id, trigger_event, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)
          ON CONFLICT (user_id, template_id) DO NOTHING;
        `, [
          ev.user_id,
          ev.email,
          ev.platform,
          tpl.title,
          tpl.message,
          tpl.btn_text,
          tpl.screen_redirect,
          sendAfter,
          tpl.id,
          ev.event_code
        ]);
      }
    }

    console.log(`✅ [SchedulerEvents] Đã tạo queue cho ${events.rowCount} event.`);
  } catch (err) {
    console.error('❌ [SchedulerEvents] Lỗi SchedulerEvents:', err);
  }
}

// 🧹 XOÁ FLOW CŨ DỰA TRÊN FUNNEL
async function cancelOldFlow(userId, newEvent) {
  const flowsToCancel = flowGroups[newEvent] || [];

  if (flowsToCancel.length === 0) return;

  await db.query(`
    DELETE FROM n_notifications_queue
    WHERE user_id = $1
    AND trigger_event = ANY($2::text[])
  `, [userId, flowsToCancel]);

  console.log(`🧹 Huỷ flow cũ: ${flowsToCancel.join(', ')} cho user ${userId}`);
}

// CRON EVERY 3 MINUTES
cron.schedule('* * * * *', scheduleNotificationsFromEvents, {
  timezone: 'Asia/Ho_Chi_Minh',
});

module.exports = { scheduleNotificationsFromEvents };