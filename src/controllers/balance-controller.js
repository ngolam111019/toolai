/**
 * Balance Controller — Thin Request/Response Layer
 */
const db = require('../config/db');
const asyncHandler = require('../utils/async-handler');

/**
 * GET /api/balance/logs
 */
const getBalanceLogs = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, amount, type, status, reason, ref_code, created_at
     FROM n_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

module.exports = { getBalanceLogs };