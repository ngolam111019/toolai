const cron = require('node-cron');
const db = require('../db/db');
const { pushNoti } = require('../utils/noti');

async function sendPendingNotifications() {
    try {
        const notis = await db.query(`
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
            WHERE n.status = 0 AND n.send_after <= NOW()
            ORDER BY n.send_after ASC
            LIMIT 50
            `);

        console.log('[before Sender]: ', notis.rows);
        for (const noti of notis.rows) {
            try {
                await pushNoti(
                    { id: noti.user_id, email: noti.email, platform: noti.platform, fcm_token: noti.fcm_token, web_push_subscription: noti.web_push_subscription },
                    { title: noti.title, message: noti.message, btnText: noti.btn_text, screen_redirect: noti.screen_redirect }
                );

                await db.query(`UPDATE n_notifications_queue SET status=1, sent_at=NOW() WHERE id=$1`, [noti.id]);

                console.log('[Sender]: ', noti);
            } catch (err) {
                await db.query(`UPDATE n_notifications_queue SET status=2, retry_count=retry_count+1 WHERE id=$1`, [noti.id]);
                console.error('❌ [Sender] Push lỗi: ', err.message);
            }
        }

        if (notis.rowCount > 0)
            console.log(`📨 [Sender] Đã gửi ${notis.rowCount} notification.`);
    } catch (err) {
        console.error('❌ [Sender] Lỗi:', err);
    }
}

cron.schedule('* * * * *', sendPendingNotifications, {
    timezone: 'Asia/Ho_Chi_Minh',
});