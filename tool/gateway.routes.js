const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { sendDiscord } = require('../utils/discordNotify');

// GET /api/gateways
router.get('/gateways', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, display_name, logo
      FROM n_gateways
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách gateways:', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [gateways]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;