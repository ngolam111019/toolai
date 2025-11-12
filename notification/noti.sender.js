const cron = require('node-cron');
const db = require('../db/db');
const { pushNoti } = require('../utils/noti');

async function sendPendingNotifications() {
  try {
    // 1️⃣ Claim trước 50 noti để tránh 2 cron gửi trùng
    const notis = await db.query(`
      UPDATE n_notifications_queue
      SET status = 9, locked_at = NOW()
      WHERE id IN (
        SELECT n.id
        FROM n_notifications_queue n
        WHERE n.status = 0 
          AND n.send_after <= NOW()
          AND (n.locked_at IS NULL OR n.locked_at < NOW() - interval '1 minute')
        ORDER BY n.send_after ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, user_id, email, platform, template_id;
    `);

    if (notis.rowCount === 0) return;

    console.log(`📬 [Sender] Claim ${notis.rowCount} noti để gửi...`);

    // 2️⃣ Join thêm dữ liệu cần thiết từ template & user
    const notiIds = notis.rows.map(n => n.id);
    const details = await db.query(`
      SELECT 
        n.id,
        n.user_id,
        n.email,
        n.platform,
        t.title,
        t.message,
        t.btn_text,
        t.screen_redirect,
        u.fcm_token,
        u.web_push_subscription
      FROM n_notifications_queue n
      JOIN n_users u ON u.id = n.user_id
      JOIN n_notification_templates t ON t.id = n.template_id
      WHERE n.id = ANY($1::int[])
    `, [notiIds]);

    // 3️⃣ Gửi từng noti (chỉ đúng kênh user đang dùng)
    for (const noti of details.rows) {
      try {
        await pushNoti(
          { id: noti.user_id, email: noti.email, platform: noti.platform, fcm_token: noti.fcm_token, web_push_subscription: noti.web_push_subscription },
          { title: noti.title, message: noti.message, btnText: noti.btn_text, screen_redirect: noti.screen_redirect }
        );

        await db.query(`UPDATE n_notifications_queue SET status=1, sent_at=NOW() WHERE id=$1`, [noti.id]);
        console.log(`[Sender ✅]: Gửi thành công noti_id=${noti.id}`);
      } catch (err) {
        await db.query(`
          UPDATE n_notifications_queue
          SET status=2, retry_count=retry_count+1
          WHERE id=$1
        `, [noti.id]);
        console.error(`❌ [Sender] Push lỗi (noti_id=${noti.id}):`, err.message);
      }
    }

    console.log(`✅ [Sender] Hoàn tất gửi ${details.rowCount} notification.`);
  } catch (err) {
    console.error('❌ [Sender] Lỗi tổng:', err);
  }
}

// ⏱ Cron chạy mỗi phút
cron.schedule('* * * * *', sendPendingNotifications, {
  timezone: 'Asia/Ho_Chi_Minh',
});

module.exports = { sendPendingNotifications };