const jwt = require('jsonwebtoken');
const db = require('../db/db');
const SECRET = process.env.JWT_SECRET || 'mysecret';

exports.authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const device_id = req.headers['x-device-id'];

  if (!token || !device_id) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const userRes = await db.query('SELECT * FROM n_users WHERE id = $1', [decoded.id]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    if (user.device_id !== device_id) {
      return res.status(403).json({ error: 'Sai thiết bị. Truy cập bị từ chối.' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};