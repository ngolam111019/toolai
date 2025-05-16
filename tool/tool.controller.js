const db = require('../db/db');
const { checkPermission } = require('./tool.middleware');

exports.useTool = async (req, res) => {
  const user_id = req.user.id;
  const gateway = req.body.gateway || 'Zon88';

  try {
    const { allowed, reason, current_package, turns_left } = await checkPermission(user_id, gateway);

    if (!allowed) return res.status(403).json({ error: reason });

    // Lưu log sử dụng
    await db.query(`
      INSERT INTO n_tool_usage_logs (user_id, gateway, prediction)
      VALUES ($1, $2, $3)
    `, [user_id, gateway, Math.random() > 0.5 ? 'Tài' : 'Xỉu']);

    const resPkg = await db.query(`
      SELECT *
      FROM n_user_packages
      WHERE user_id = $1
    `, [user_id]);
  
    if (!resPkg.rows.length) return { allowed: false, reason: 'Không có gói nào hoạt động' };
  
    const pkg = resPkg.rows[0];
    //console.log(pkg.turns_used_today + 1);
    

    // Cập nhật lượt chơi
    await db.query(`
      UPDATE n_user_packages
      SET turns_used_today = (turns_used_today + 1)
      WHERE user_id = $1
    `, [user_id]);

    res.json({
      result: Math.random() > 0.5 ? 'Tài' : 'Xỉu',
      turns_left: turns_left - 1,
      gateway
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tool error' });
  }
};