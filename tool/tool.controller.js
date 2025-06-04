const db = require('../db/db');
const { sendDiscord } = require('../utils/discordNotify');

async function useTool(req, res) {
  try {
    const userId = req.user.id;
    const { gateway, result, round_code } = req.body;

    if (!gateway) return res.status(400).json({ message: 'Thiếu tham số gateway' });

    // (0) Kiểm tra quyền truy cập
    if (req.pkg?.allowed_gateways?.includes && !req.pkg.allowed_gateways.includes(gateway)) {
      return res.status(403).json({ message: 'Cổng này không thuộc gói bạn đang dùng' });
    }

    const userPackageId = req.pkg?.id;

    let finalResult = result;
    let shouldLog = false;

    // (1) Nếu là Zon88 và đủ thông tin → ghi log
    if (gateway === process.env.GATEWAY_DEMO && result && round_code) {
      if (result >= 3 && result<= 10) {
        finalResult =  'Xỉu';
      }
      else if (result >= 11 && result<= 18){
        finalResult = 'Tài';
      }
      else {
        finalResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
      }
      shouldLog = true;
    } else {
      // (2) Nếu thiếu thông tin hoặc cổng khác → tạo kết quả ngẫu nhiên
      finalResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
    }

    // (3) Ghi log nếu đủ điều kiện
    if (shouldLog) {
      await db.query(`
        INSERT INTO n_tool_usage_logs (user_id, gateway, prediction, round_code)
        VALUES ($1, $2, $3, $4)
      `, [userId, gateway, finalResult, round_code]);
    }
    console.log("userPackageId: " + userPackageId);
    // (4) Trừ lượt nếu có gói
    if (userPackageId) {
      await db.query(`
        UPDATE n_user_packages
        SET turns_used_today = COALESCE(turns_used_today, 0) + 1
        WHERE id = $1
      `, [userPackageId]);
    }

    // (5) Trả kết quả + lượt còn lại
    const max = req.pkg?.max_turns || 0;
    const used = req.pkg?.turns_used + 1;
    const turnsLeft = max - used;

    return res.json({
      result: (round_code ? '#'+round_code + ' - ' + finalResult : finalResult),
      turns_left: turnsLeft
    });

  } catch (err) {
    console.error('[useTool]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [useTool]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi xử lý tool' });
  }
}

module.exports = {
  useTool
};