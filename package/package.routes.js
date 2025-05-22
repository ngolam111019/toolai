const express = require('express');
const router = express.Router();
const db = require('../db/db');
const jwt = require('jsonwebtoken');
const controller = require('./package.controller');
const { authMiddleware } = require('../auth/auth.middleware')

// GET /api/packages
router.get('/packages', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, price, duration_days, gateways, description, color, bg_color, is_best_saler, max_turns_per_day, is_gift
      FROM n_packages
      WHERE id > 0
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách gói:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// GET /api/package/status
router.get('/status', authMiddleware, controller.getPackageStatus);

router.post('/upgrade', authMiddleware, controller.upgradePackage);


module.exports = router;