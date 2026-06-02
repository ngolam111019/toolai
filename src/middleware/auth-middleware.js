const jwt = require('jsonwebtoken');
const db = require('../config/db');
const SECRET = process.env.JWT_SECRET || 'mysecret';
const { sendDiscord } = require('../utils/discord-notify');

exports.authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const device_id = req.headers['x-device-id'];

  if (!token || !device_id) return res.status(401).json({ message: 'Lỗi xác thực' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const userRes = await db.query('SELECT * FROM n_users WHERE id = $1', [decoded.id]);
    if (!userRes.rows.length) return res.status(404).json({ message: 'Tài khoản không tồn tại' });

    const user = userRes.rows[0];
    if (user.device_id !== device_id) {
      return res.status(403).json({ message: 'Sai thiết bị. Truy cập bị từ chối.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.message == "jwt expired") {
      res.status(401).json({ message: 'Phiên sử dụng hết hiệu lực. Vui lòng đăng nhập lại.' });
    }
    else {
      sendDiscord('error', `🚨 Lỗi hệ thống [authMiddleware]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
      res.status(401).json({ message: 'Invalid token' });
    }
  }
};