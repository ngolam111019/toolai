/**
 * UsageLog Controller — Thin Request/Response Layer
 */
const db = require('../config/db');
const asyncHandler = require('../utils/async-handler');

const USAGE_LOG_FIELDS = 'gateway, round_code, prediction, used_at';
const USAGE_LOG_QUERY = `SELECT ${USAGE_LOG_FIELDS} FROM n_tool_usage_logs WHERE user_id = $1 ORDER BY used_at DESC LIMIT 100`;

/**
 * GET /api/usagelog
 */
exports.getUsageLogs = asyncHandler(async (req, res) => {
  const { rows } = await db.query(USAGE_LOG_QUERY, [req.user.id]);
  res.json(rows);
});

/**
 * GET /api/usagelog/trial
 */
exports.checkUsageTrial = asyncHandler(async (req, res) => {
  const { rows } = await db.query(USAGE_LOG_QUERY, [req.user.id]);
  res.json(rows);
});