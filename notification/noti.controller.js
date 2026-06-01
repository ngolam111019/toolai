/**
 * Notification Controller — Thin Request/Response Layer
 */
const db = require('../db/db');
const asyncHandler = require('../src/utils/async-handler');
const { pushNoti } = require('../utils/noti');
const AppError = require('../src/utils/app-error');

/**
 * POST /api/noti/test — Test gửi notification + lưu DB
 */
exports.testNoti = asyncHandler(async (req, res) => {
  const user = req.user;
  const payload = {
    title: 'Bạn có 5 lượt dùng thử miễn phí',
    message: 'Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!',
    btnText: 'Nâng cấp ngay',
    screen_redirect: 'package',
    meta_json: { test: true },
  };

  const log = await db.query(
    `INSERT INTO n_user_notifications (user_id, title, body, type, deep_link, image_url, meta_json, is_read, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, FALSE, NOW(), NOW()) RETURNING id`,
    [user.id, payload.title, payload.message, 'TEST_NOTI', payload.screen_redirect, null, JSON.stringify(payload.meta_json)]
  );
  const localId = log.rows[0].id;

  await pushNoti(user, { ...payload, localId: localId.toString() });
  res.json({ message: 'Gửi noti + lưu DB thành công', localId });
});

/**
 * GET /api/noti?since=... — Incremental sync
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { since } = req.query;

  const FIELDS = 'id, title, body, type, deep_link, image_url, meta_json, is_read, created_at';

  const { rows } = since
    ? await db.query(
        `SELECT ${FIELDS} FROM n_user_notifications WHERE user_id = $1 AND updated_at > $2 ORDER BY created_at DESC`,
        [userId, since]
      )
    : await db.query(
        `SELECT ${FIELDS} FROM n_user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );

  res.json({ server_time: new Date().toISOString(), notifications: rows });
});

/**
 * GET /api/noti/page?page=1
 */
exports.getNotificationsPage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { rows } = await db.query(
    `SELECT id, title, body, type, deep_link, image_url, meta_json, is_read, created_at
     FROM n_user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  res.json({ page, notifications: rows });
});

/**
 * POST /api/noti/mark-read
 */
exports.markRead = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Danh sách IDs không hợp lệ', 400, 'INVALID_IDS');
  }

  await db.query(
    `UPDATE n_user_notifications SET is_read = TRUE, updated_at = NOW() WHERE user_id = $1 AND id = ANY($2::int[])`,
    [req.user.id, ids]
  );

  res.json({ success: true });
});