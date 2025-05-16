const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'mysecret';

exports.register = async (req, res) => {
  const { email, password, device_id } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const existing = await db.query('SELECT id FROM n_users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already exists' });

    const userRes = await db.query(`
      INSERT INTO n_users (email, password_hash, device_id) 
      VALUES ($1, $2, $3) RETURNING id
    `, [email, hashed, device_id]);

    // gán gói dùng thử (package_id = 0)
    await db.query(`
      INSERT INTO n_user_packages (user_id, package_id, activated_at)
      VALUES ($1, 0, NOW())
    `, [userRes.rows[0].id]);

    res.json({ message: 'Registered successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Register failed' });
  }
};

exports.login = async (req, res) => {
  const { email, password, device_id } = req.body;
  try {
    const userRes = await db.query('SELECT * FROM n_users WHERE email = $1', [email]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // kiểm tra device_id
    if (user.device_id && user.device_id !== device_id) {
      return res.status(403).json({ error: 'Thiết bị không hợp lệ. Tài khoản đã gắn với thiết bị khác.' });
    }

    // nếu chưa có device_id → gắn thiết bị này
    if (!user.device_id) {
      await db.query('UPDATE n_users SET device_id = $1 WHERE id = $2', [device_id, user.id]);
    }

    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  // TODO: Gửi email chứa token reset password
  res.json({ message: 'Reset link sent (fake)' });
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE n_users SET password_hash = $1 WHERE email = $2', [hash, email]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed' });
  }
};