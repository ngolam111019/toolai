const db = require('../db/db');
const { pushNoti } = require('../utils/noti');

/**
 * 1. TEST gửi notification + LƯU DB
 */
async function testNoti(req, res) {
  try {
    const user = req.user;

    const payload = {
      title: 'Bạn có 5 lượt dùng thử miễn phí',
      message:
        'Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!',
      btnText: 'Nâng cấp ngay',
      screen_redirect: 'package',
      meta_json: { test: true }
    };

    // 1️⃣ Lưu noti vào DB trước
    const insertSql = `
      INSERT INTO n_user_notifications
        (user_id, title, body, type, deep_link, image_url, meta_json, is_read, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7::jsonb, FALSE, NOW(), NOW())
      RETURNING id;
    `;

    const log = await db.query(insertSql, [
      user.id,
      payload.title,
      payload.message,
      'TEST_NOTI',
      payload.screen_redirect,
      null,
      JSON.stringify(payload.meta_json || {})
    ]);

    const localId = log.rows[0].id;

    // 2️⃣ Push noti kèm localId
    await pushNoti(
      user,
      {
        title: payload.title,
        message: payload.message,
        btnText: payload.btnText,
        screen_redirect: payload.screen_redirect,
        localId: localId.toString()
      }
    );

    return res.status(200).json({
      message: 'Gửi noti + lưu DB thành công',
      localId
    });

  } catch (err) {
    console.error('[noti.testNoti]', err);
    res.status(500).json({ message: 'Lỗi xử lý tool' });
  }
}

/**
 * 2. API GET /notifications?since=...
 * Incremental sync
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const since = req.query.since;

    let sql;
    let params;

    console.log(req.user.id);
    if (!since) {
      // Lần đầu → trả 50 bản mới nhất
      console.log("Lần đầu → trả 50 bản mới nhất");
      sql = `
        SELECT id, title, body, type, deep_link, image_url, meta_json, is_read, created_at
        FROM n_user_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      params = [userId];
    } else {
      // Incremental sync → lấy bản mới hơn since
      console.log("Incremental sync → lấy bản mới hơn since");
      sql = `
        SELECT id, title, body, type, deep_link, image_url, meta_json, is_read, created_at
        FROM n_user_notifications
        WHERE user_id = $1 AND updated_at > $2
        ORDER BY created_at DESC
      `;
      params = [userId, since];
    }

    const result = await db.query(sql, params);

    return res.json({
      server_time: new Date().toISOString(),
      notifications: result.rows
    });

  } catch (err) {
    console.error('[noti.getNotifications]', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

/**
 * 3. API GET /notifications/page?page=1
 */
async function getNotificationsPage(req, res) {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `
      SELECT id, title, body, type, deep_link, image_url, meta_json, is_read, created_at
      FROM n_user_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    return res.json({
      page,
      notifications: result.rows
    });

  } catch (err) {
    console.error('[noti.getNotificationsPage]', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

/**
 * 4. API POST /notifications/mark-read
 */
async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const ids = req.body.ids || [];
    console.log("ids: " + ids);
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'INVALID_IDS' });
    }

    await db.query(
      `
      UPDATE n_user_notifications
      SET is_read = TRUE, updated_at = NOW()
      WHERE user_id = $1 AND id = ANY($2::int[])
      `,
      [userId, ids]
    );

    return res.json({ success: true });

  } catch (err) {
    console.error('[noti.markRead]', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

module.exports = {
  testNoti,
  getNotifications,
  getNotificationsPage,
  markRead
};