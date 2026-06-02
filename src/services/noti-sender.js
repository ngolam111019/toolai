const cron = require('node-cron');
const db = require('../config/db');
const { pushNoti } = require('../utils/noti');

async function sendPendingNotifications() {
  try {
    // 1️⃣ Claim tối đa 50 noti
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
      RETURNING id, user_id, template_id, trigger_event;
    `);

    if (notis.rowCount === 0) return;

    console.log(`📬 [Sender] Claim ${notis.rowCount} noti để gửi...`);

    // 2️⃣ JOIN đầy đủ user & template
    const ids = notis.rows.map(n => n.id);
    const details = await db.query(`
      SELECT 
        q.id,
        q.user_id,
        q.trigger_event,
        t.title,
        t.message,
        t.btn_text,
        t.screen_redirect,
        u.email,
        u.platform,
        u.fcm_token,
        u.web_push_subscription,
        p.package_id as current_package,
       	case when package_id = 0 then turns_used_today else 0 end trial_used,
       	case when package_id = 1 then turns_used_today else 0 end trial_pro_used
      FROM n_notifications_queue q
      JOIN n_users u ON u.id = q.user_id
      JOIN n_notification_templates t ON t.id = q.template_id
	    left join public.n_user_packages p ON u.id = p.user_id
      WHERE q.id = ANY($1::int[])
    `, [ids]);

    for (const noti of details.rows) {

      // 3️⃣ Logic chặn NOTI tùy theo flow
      const shouldSkip = await shouldSkipNotification(noti);
      if (shouldSkip) {
        await db.query(`
          UPDATE n_notifications_queue
          SET status = 3, canceled_at = NOW()
          WHERE id = $1
        `, [noti.id]);
        console.log(`🚫 [Sender] Skip noti_id=${noti.id} (logic matched)`);
        continue;
      }

      // 4️⃣ Lưu vào DB → push → update queue
      try {
        // 4.1 Lưu vào bảng n_user_notifications để app sync
        const insertLog = `
          INSERT INTO n_user_notifications
            (user_id, title, body, type, deep_link, image_url, meta_json, is_read, created_at, updated_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7::jsonb, FALSE, NOW(), NOW())
          RETURNING id;
        `;

        const logValues = [
          noti.user_id,
          noti.title,
          noti.message,
          noti.trigger_event,          // type = trigger_event
          noti.screen_redirect,         // deep_link
          null,                         // image_url (nếu sau này có thì map)
          JSON.stringify({
            template_id: noti.template_id,
            btn_text: noti.btn_text
          })
        ];

        const logRes = await db.query(insertLog, logValues);
        const localId = logRes.rows[0].id;

        // 4.2 Gửi noti kèm localId để client sync chính xác
        await pushNoti(
          {
            id: noti.user_id,
            email: noti.email,
            platform: noti.platform,
            fcm_token: noti.fcm_token,
            web_push_subscription: noti.web_push_subscription
          },
          {
            title: noti.title,
            message: noti.message,
            btnText: noti.btn_text,
            screen_redirect: noti.screen_redirect,
            localId: localId.toString()
          }
        );

        // 4.3 Update queue
        await db.query(
          `UPDATE n_notifications_queue SET status=1, sent_at=NOW() WHERE id=$1`,
          [noti.id]
        );

        console.log(`✅ [Sender] Sent noti_id=${noti.id} | log_id=${localId}`);

      } catch (err) {
        await db.query(`
          UPDATE n_notifications_queue
          SET status=2, retry_count=retry_count+1
          WHERE id=$1
        `, [noti.id]);

        console.error(`❌ [Sender] Push lỗi noti_id=${noti.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ [Sender] Lỗi tổng:', err);
  }
}

// 🧠 Logic chặn NOTI theo từng flow
async function shouldSkipNotification(noti) {

  // =========== 1. SIGNUP ===========
  if (noti.trigger_event === 'ON_SIGNUP') {
    if (noti.trial_used >= 3) return true;
    if (noti.current_package !== 0) return true;
  }

  // =========== 1B. SIGNUP_TRIAL_USED (>=3 lượt) ===========
  if (noti.trigger_event === 'ON_SIGNUP_TRIAL_USED') {
    if (noti.current_package !== 0) return true;
    if (noti.trial_used < 3) return true;
  }

  // =========== 2. TRIAL PRO ===========
  if (noti.trigger_event === 'ON_UPGRADE_TRIAL_PRO') {
    if (noti.trial_pro_used >= 10) return true;
    if (noti.current_package !== 1) return true;
  }

  // =========== 3. PREMIUM ===========
  if (noti.trigger_event === 'ON_UPGRADE_PREMIUM') {
    if (noti.current_package !== 2) return true;
  }

  // =========== 4. PRO ===========
  if (noti.trigger_event === 'ON_PREMIUM_PRO_INACTIVE') {
    if (noti.current_package !== 3) return true;
  }

  return false;
}

// Cron mỗi phút
cron.schedule('* * * * *', sendPendingNotifications, {
  timezone: 'Asia/Ho_Chi_Minh',
});

module.exports = { sendPendingNotifications };