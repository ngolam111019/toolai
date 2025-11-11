// /notification/noti.scheduler.events.js
const cron = require('node-cron');
const db = require('../db/db');
const { DateTime } = require('luxon');

async function scheduleNotificationsFromEvents() {
  try {
    console.log('[SchedulerEvents] Quét sự kiện mới...');

    const events = await db.query(`
      SELECT e.id, e.user_id, e.event_code, e.event_time, u.email, u.platform
      FROM (
		select e.user_id, max(e.event_time) as event_time
		from public.n_user_event_logs e
		group by e.user_id) e1
	  JOIN n_user_event_logs e ON e1.user_id = e.user_id and e1.event_time = e.event_time
      JOIN n_users u ON u.id = e.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM n_notifications_queue q
        WHERE q.user_id = e.user_id AND q.trigger_event = e.event_code
      )
      LIMIT 100
    `);

    if (events.rowCount === 0) {
      console.log('[SchedulerEvents] Không có event mới.');
      return;
    }

    const templates = await db.query(`
      SELECT * FROM n_notification_templates WHERE is_active = TRUE
    `);

    for (const ev of events.rows) {
      // 🧩 1️⃣ Huỷ các flow cũ nếu có
      await cancelOldFlow(ev.user_id, ev.event_code);

      // 🧩 2️⃣ Lấy template tương ứng flow mới
      const listTpl = templates.rows.filter(t => t.trigger_event === ev.event_code);

      // 🧩 3️⃣ Tạo queue mới
      for (const tpl of listTpl) {
        const sendAfter = DateTime.fromJSDate(ev.event_time)
          .plus({ hours: tpl.delay_hours })
          .toJSDate();

        await db.query(`
          INSERT INTO n_notifications_queue
          (user_id, email, platform, title, message, btn_text, screen_redirect, send_after, template_id, trigger_event, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)
          ON CONFLICT (user_id, template_id) DO NOTHING
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

    console.log(`✅ [SchedulerEvents] Đã tạo job cho ${events.rowCount} sự kiện.`);
  } catch (err) {
    console.error('❌ [SchedulerEvents] Lỗi:', err);
  }
}

// ✅ Hàm huỷ flow cũ khi user chuyển giai đoạn
async function cancelOldFlow(userId, newEvent) {
  const flowGroups = {
    ON_SIGNUP: ['ON_SIGNUP'], 
    ON_UPGRADE_TRIAL_PRO: ['ON_SIGNUP', 'ON_UPGRADE_TRIAL_PRO', 'ON_UPGRADE_PREMIUM', 'ON_PREMIUM_PRO_INACTIVE'],
    ON_UPGRADE_PREMIUM: ['ON_SIGNUP', 'ON_UPGRADE_TRIAL_PRO', 'ON_UPGRADE_PREMIUM', 'ON_PREMIUM_PRO_INACTIVE'],
    ON_PREMIUM_PRO_INACTIVE: ['ON_SIGNUP', 'ON_UPGRADE_TRIAL_PRO', 'ON_UPGRADE_PREMIUM', 'ON_PREMIUM_PRO_INACTIVE']
  };

  // Xác định tất cả flow cũ cần xoá
  const oldFlows = Object.values(flowGroups)
    .find(g => g.includes(newEvent))  // Tìm nhóm chứa flow hiện tại
    ?.filter(e => e !== newEvent) || [];

  if (oldFlows.length === 0) return;

  await db.query(`
    DELETE FROM n_notifications_queue
    WHERE user_id = $1 AND trigger_event = ANY($2::text[])
  `, [userId, oldFlows]);

  console.log(`🧹 Đã huỷ ${oldFlows.join(', ')} cho user ${userId}`);
}

// Cron 10 phút
cron.schedule('*/3 * * * *', scheduleNotificationsFromEvents, {
  timezone: 'Asia/Ho_Chi_Minh',
});

module.exports = { scheduleNotificationsFromEvents };