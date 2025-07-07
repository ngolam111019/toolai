const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { sendDiscord } = require('../utils/discordNotify');

// GET /api/gateways
router.get('/gateways', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, display_name, logo, link_video, link_channel
      FROM n_gateways
      where visible = true
      ORDER BY "order" ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách gateways:', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [gateways]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;