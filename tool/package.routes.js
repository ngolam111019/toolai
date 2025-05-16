const express = require('express');
const router = express.Router();
const db = require('../db/db');
const jwt = require('jsonwebtoken');

// GET /api/packages
router.get('/packages', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, price, description
      FROM n_packages
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách gói:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// GET /api/package/status
router.get('/status', async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const deviceId = req.headers['x-device-id'];
      if (!token || !deviceId) return res.status(401).json({ error: 'Thiếu token hoặc deviceId' });
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
  
      // Lấy gói hiện tại
      const { rows } = await db.query(`
        SELECT up.*, p.name, p.price, p.max_turns_per_day
        FROM n_user_packages up
        JOIN n_packages p ON up.package_id = p.id
        WHERE up.user_id = $1
        ORDER BY up.expired_at DESC NULLS LAST
        LIMIT 1
      `, [userId]);
  
      if (!rows.length) return res.json({ active: false });
  
      const pkg = rows[0];
      const today = new Date().toISOString().slice(0, 10);
  
      // Reset lượt nếu qua ngày
      if (pkg.last_turn_reset?.toISOString().slice(0, 10) !== today) {
        await db.query(`
          UPDATE n_user_packages
          SET turns_used_today = 0, last_turn_reset = CURRENT_DATE
          WHERE id = $1
        `, [pkg.id]);
        pkg.turns_used_today = 0;
      }
  
      const turns_left = pkg.max_turns_per_day - pkg.turns_used_today;
  
      res.json({
        active: true,
        package_id: pkg.package_id,
        name: pkg.name,
        price: pkg.price,
        turns_used_today: pkg.turns_used_today,
        max_turns_per_day: pkg.max_turns_per_day,
        turns_left,
        expire_at: pkg.expire_at
      });
  
    } catch (err) {
      console.error('Lỗi /package/status:', err);
      res.status(500).json({ error: 'Lỗi server' });
    }
  });

module.exports = router;