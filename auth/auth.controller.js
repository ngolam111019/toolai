const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'mysecret';
const {sendOtpEmail, sendEmailDangKyThanhCong, sendEmailFogotPassword } = require('../utils/mailer');
const { pushNoti } = require('../utils/noti');
const { sendDiscord } = require('../utils/discordNotify');
const format = require('../utils/format');
const common = require('../utils/common');
const { OAuth2Client } = require('google-auth-library');

exports.login = async (req, res) => {
  const { email, password, device_id } = req.body;

  if (!common.isValidEmail(email)) 
    return res.status(400).json({ message: 'Email sai định dạng' });

  try {
    const userRes = await db.query('SELECT * FROM n_users WHERE email = $1', [email]);
    if (!userRes.rows.length) return res.status(404).json({ message: 'Tài khoản không tồn tại. Hãy đăng ký tài khoản' });

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' });

    // kiểm tra device_id
    if (user.device_id && user.device_id !== device_id) {
      return res.status(403).json({ message: 'Thiết bị không hợp lệ. Tài khoản đã gắn với thiết bị khác.' });
    }
    let userId = user.id;
    // Nếu hết hạn và chưa dùng thử | dùng thử dưới 3 lượt 
    let userPackages = await db.query('SELECT id, expired_at FROM n_user_packages WHERE user_id = $1 LIMIT 1', [userId]);
    if (userPackages.rows.length > 0) {
      var userPackage = userPackages.rows[0];
      var now = format.getTodayVNDatetime();

      console.log("now: " + now);
      console.log("userPackage: " + userPackage.expired_at);
      if(now > userPackage.expired_at){
        //hết hạn
        console.log("hết hạn");
        const n_tool_usage_logs = await db.query(`
          SELECT COUNT (*) trial_used
          FROM public.n_tool_usage_logs
          WHERE gateway = 'Zon88' and user_id = $1
          GROUP BY user_id
          LIMIT 1
        `, [userId]);

        // Chưa dùng thử hoặc dùng thử dưới 3 lượt
        if(n_tool_usage_logs.rows.length < 3){
          console.log("Chưa dùng thử hoặc dùng thử dưới 3 lượt");
          await db.query(`
            UPDATE n_user_packages 
            SET expired_at = NOW() + interval '24 hours',
              last_turn_reset = NOW()
            WHERE id = $1`, 
          [userPackage.id]);
        }
      }
      else {
        //còn hạn
        console.log("còn hạn: " + userId);
      }
    }

    // nếu chưa có device_id → gắn thiết bị này
    // và gửi thông báo đăng nhập lần đầu
    if (!user.device_id) {
      await db.query('UPDATE n_users SET device_id = $1 WHERE id = $2', [device_id, user.id]);

      pushNoti(user,
          {
            title: "Bạn có 5 lượt dùng thử miễn phí", 
            message: "Bạn có 5 lượt dùng thử miễn phí cho cổng game Zon88 trong 24h. Thử ngay để thấy độ chính xác của Tool AI nhé!",
            btnText: "Thử ngay", 
            screen_redirect: "tool"
          });
    }
    
    const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
    res.json({ message: 'Đăng nhập thành công', token, email, deviceId: device_id });
  } catch (err) {
    sendDiscord('error', `🚨 Lỗi hệ thống [login]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Đăng nhập không thành công' });
  }
};

/* Start flow - đăng ký tài khoản */
exports.requestOtp = async (req, res) => {
  const { email } = req.body;
  
  if (!email) 
    return res.status(400).json({ message: 'Email không được để trống' });

  if (!common.isValidEmail(email)) 
    return res.status(400).json({ message: 'Email sai định dạng' });
  
  try {
    const userCheck = await db.query('SELECT id FROM n_users WHERE email = $1', [email]);
    if (userCheck.rows.length) return res.status(400).json({ message: 'Email đã được đăng ký' });

    var now = format.getTodayVNDatetime();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 phút

    await db.query(`
      INSERT INTO n_user_pending (email, otp, expires_at, verified, created_at)
      VALUES ($1, $2, $3, false, $4)
      ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = $3, created_at = $4, verified = false
    `, [email, otp, expiresAt, now]);

    res.json({ message: 'OTP đã được gửi tới email của bạn' });

    sendOtpEmail(email, otp, 'Mã xác thực tài khoản của bạn')
      .catch(err => console.log("Lỗi gửi mail [requestOtp - đăng ký tài khoản]:", err.message));

  } catch (err) {
    console.log(err);
    sendDiscord('error', `🚨 Lỗi hệ thống [requestOtp - đăng ký tài khoản]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'requestOtp Đăng ký tài khoản thất bại' });
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Thiếu email hoặc mã OTP' });

  try {
    var now = format.getTodayVNDatetime();
    const { rows } = await db.query(`
      SELECT * FROM n_user_pending
      WHERE email = $1 AND otp = $2 AND expires_at >= $3
    `, [email, otp, now]);

    console.log("verifyOtp now: " + now);
    if (!rows.length) return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });

    await db.query(`UPDATE n_user_pending SET verified = true WHERE email = $1`, [email]);
    res.json({ message: 'Xác minh OTP thành công' });
  } catch (err) {
    console.log(err);
    sendDiscord('error', `🚨 Lỗi hệ thống [verifyOtp - đăng ký tài khoản]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'verifyOtp đăng ký tài khoản thất bại' });
  }
};
exports.confirmRegister = async (req, res) => {
  const { email, password, device_id } = req.body;
  try {

    const hashed = await bcrypt.hash(password, 10);
    const existing = await db.query('SELECT id FROM n_users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ message: 'Email này đã được đăng ký' });

    const userRes = await db.query(`
      INSERT INTO n_users (email, password_hash, device_id) 
      VALUES ($1, $2, $3) RETURNING id
    `, [email, hashed, device_id]);

    // gán gói dùng thử (package_id = 0)
    await db.query(`
      INSERT INTO n_user_packages (user_id, package_id, activated_at, expired_at, last_turn_reset)
      VALUES ($1, 0, NOW(), NOW() + interval '24 hours', NOW())
    `, [userRes.rows[0].id]);

    await db.query('DELETE FROM n_user_pending WHERE email = $1', [email]);

    const token = jwt.sign({ id: userRes.rows[0].id }, SECRET, { expiresIn: '30d' });
    res.json({ message: 'Đăng ký tài khoản thành công', token, email, deviceId: device_id  });
   
    sendEmailDangKyThanhCong(email, password).catch(err => console.log("Lỗi gửi mail [confirmRegister - đăng ký tài khoản]:", err.message));
  } catch (err) {
    console.log(err);
    sendDiscord('error', `🚨 Lỗi hệ thống [confirmRegister - đăng ký tài khoản]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Đăng ký tài khoản thất bại' });
  }
};
/* End flow - đăng ký tài khoản */

/* Start flow - Quên mật khẩu */
exports.requestReset = async (req, res) => {
  const { email } = req.body;
  if (!email) 
    return res.status(400).json({ message: 'Email không được để trống' });

  if (!common.isValidEmail(email)) 
    return res.status(400).json({ message: 'Email sai định dạng' });

  try {
    // Kiểm tra email có tồn tại không
    const existing = await db.query('SELECT id FROM n_users WHERE email = $1', [email]);
    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    // Tạo OTP ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu hoặc cập nhật OTP
    await db.query(`
      INSERT INTO n_reset_otps (email, otp, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (email) DO UPDATE SET otp = $2, created_at = NOW()
    `, [email, otp]);

    // Gửi mail
    await sendOtpEmail(email, otp, 'Mã OTP khôi phục mật khẩu');

    return res.json({ message: 'OTP đã được gửi về email' });
  } catch (err) {
    console.error('[requestReset]', err);

    sendDiscord('error', `🚨 Lỗi hệ thống [requestReset - Quên mật khẩu]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi xử lý khôi phục' });
  }
};
exports.verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Thiếu email hoặc mã OTP' });

  try {
    const { rows } = await db.query(`
      SELECT otp, created_at
      FROM n_reset_otps
      WHERE email = $1
    `, [email]);

    if (!rows.length) return res.status(400).json({ message: 'Không tìm thấy OTP' });

    const record = rows[0];

    // So khớp OTP
    if (record.otp !== otp) {
      return res.status(400).json({ message: 'Mã OTP không đúng' });
    }

    // Kiểm tra thời gian hiệu lực (5 phút)
    const createdAt = new Date(record.created_at);
    const now = new Date();
    const diffMs = now - createdAt;
    const diffMin = diffMs / 1000 / 60;

    if (diffMin > 5) {
      return res.status(400).json({ message: 'Mã OTP đã hết hạn' });
    }

    // ✅ OTP hợp lệ
    return res.json({ message: 'Xác minh OTP thành công' });
  } catch (err) {
    console.error('[verifyResetOtp]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [verifyResetOtp - Quên mật khẩu]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Lỗi xác minh OTP' });
  }
};
exports.sendNewPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Thiếu email' });

  try {
    // Kiểm tra email đã từng request reset chưa
    const { rows } = await db.query(`
      SELECT otp, created_at
      FROM n_reset_otps
      WHERE email = $1
    `, [email]);

    if (!rows.length) {
      return res.status(400).json({ message: 'Email chưa xác minh OTP' });
    }

    // Sinh mật khẩu mới
    const newPassword = Math.random().toString(36).slice(-8); // ví dụ: "x9z2lmf4"
    const hashed = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu
    await db.query(`UPDATE n_users SET password_hash = $1 WHERE email = $2`, [hashed, email]);

    // Gửi email
    await sendEmailFogotPassword(email, newPassword);

    // Xoá bản ghi OTP sau khi dùng xong
    await db.query(`DELETE FROM n_reset_otps WHERE email = $1`, [email]);

    res.json({ message: 'Mật khẩu mới đã được gửi về email' });

  } catch (err) {
    console.error('[sendNewPassword]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [sendNewPassword - Quên mật khẩu]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    res.status(500).json({ message: 'Không thể gửi mật khẩu mới' });
  }
};
/* End flow - Quên mật khẩu */

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Thiếu thông tin' });

  try {
    const userRes = await db.query(`SELECT password_hash FROM n_users WHERE id = $1`, [userId]);
    const user = userRes.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE n_users SET password_hash = $1 WHERE id = $2`, [hash, userId]);

    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[changePassword]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [changePassword]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    return res.status(500).json({ message: 'Lỗi đổi mật khẩu' });
  }
};

exports.fcmToken = async (req, res) => {
  const userId = req.user.id;
  const { fcm_token } = req.body;

  if (!fcm_token)
    return res.status(400).json({ message: 'Thiếu thông tin' });

  try {
    await db.query(`UPDATE n_users SET fcm_token = $1 WHERE id = $2`, [fcm_token, userId]);

    return res.json({ message: 'Cập nhật fcm_token thành công' });
  } catch (err) {
    console.error('[fcmToken]', err);
    sendDiscord('error', `🚨 Lỗi hệ thống [fcmToken]: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
    return res.status(500).json({ message: 'Lỗi cập nhật fcm_token' });
  }
};

exports.authGoogle = async (req, res) => {
  const { idToken, deviceId, platform } = req.body;
  console.log('1. req.body');
  console.log(req.body);
  try {
    var googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (platform == 1){
      googleClientId = process.env.GOOGLE_CLIENT_ID_WEB_APP;
    }

    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      aud: googleClientId
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    console.log('2. ticket.getPayload()');
    // Check DB: nếu user chưa tồn tại thì tạo mới
    let userId, isNew = false, password;
    let user = await db.query('SELECT id, device_id FROM n_users WHERE email = $1', [email]);
    
    if (user.rows.length == 0) {
      console.log('3. Tạo user');
      password = Math.random().toString(36).slice(-8);
      const hashed = await bcrypt.hash(password, 10);
      const userRes = await db.query(`
        INSERT INTO n_users (email, password_hash, device_id) 
        VALUES ($1, $2, $3) RETURNING id
      `, [email, hashed, deviceId]);
      userId = userRes.rows[0].id;

      // gán gói dùng thử (package_id = 0)
      await db.query(`
        INSERT INTO n_user_packages (user_id, package_id, activated_at, expired_at, last_turn_reset)
        VALUES ($1, 0, NOW(), NOW() + interval '24 hours', NOW())
      `, [userId]);
      isNew = true;
    }
    else {
      console.log('4. user đã có');
      var existUser = user.rows[0];
      userId = existUser.id
      
      // Nếu hết hạn và chưa dùng thử | dùng thử dưới 3 lượt 
      let userPackages = await db.query('SELECT id, expired_at FROM n_user_packages WHERE user_id = $1 LIMIT 1', [userId]);
      if (userPackages.rows.length > 0) {
        var userPackage = userPackages.rows[0];
        var now = format.getTodayVNDatetime();

        console.log("now: " + now);
        console.log("userPackage: " + userPackage.expired_at);
        if(now > userPackage.expired_at){
          //hết hạn
          console.log("hết hạn");
          const n_tool_usage_logs = await db.query(`
            SELECT COUNT (*) trial_used
            FROM public.n_tool_usage_logs
            WHERE gateway = 'Zon88' and user_id = $1
            GROUP BY user_id
            LIMIT 1
          `, [userId]);

          // Chưa dùng thử hoặc dùng thử dưới 3 lượt
          if(n_tool_usage_logs.rows.length < 3){
            console.log("Chưa dùng thử hoặc dùng thử dưới 3 lượt");
            await db.query(`
              UPDATE n_user_packages 
              SET expired_at = NOW() + interval '24 hours',
                last_turn_reset = NOW()
              WHERE id = $1`, 
            [userPackage.id]);
          }
        }
        else {
          //còn hạn
          console.log("còn hạn: " + userId);
        }
      }
      console.log('5. !existUser.device_id');
      // kiểm tra device_id
      if(!existUser.device_id) {
        await db.query('UPDATE n_users SET device_id = $1 WHERE id = $2', [deviceId, userId]);
      }
      else if (existUser.device_id !== deviceId) {
        return res.status(403).json({ message: 'Thiết bị không hợp lệ. Tài khoản đã gắn với thiết bị khác.' });
      }


    }

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'Đăng nhập thành công', token, email, deviceId});

    console.log('6. sendEmailDangKyThanhCong');
    if(isNew){
      sendEmailDangKyThanhCong(email, password).catch(err => console.log("Lỗi gửi mail [confirmRegister - đăng ký tài khoản]:", err.message));
    }

    console.log('7. end sendEmailDangKyThanhCong');
  } catch (err) {
    console.log("đănh nhập GG: " + err);
    res.status(401).json({ error: err });
  }
}

exports.saveWebSubscription = async (req, res) => {
try {
    const userId = req.user.id;
    const { subscription } = req.body;

    await db.query(`
      UPDATE n_users 
      SET web_push_subscription = $1,
          platform = $2
      WHERE id = $3
    `, [subscription, 1, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi lưu web push subscription:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
}

exports.checkToken = async (req, res) => {
  try {
    // Lấy token & device_id từ header
    const token = req.headers.authorization?.split(" ")[1];
    const device_id = req.headers["x-device-id"];

    if (!token) 
      return res.status(401).json({ valid: false, message: "Thiếu token" });
    if (!device_id) 
      return res.status(401).json({ valid: false, message: "Thiếu device_id" });

    // Giải mã token
    const decoded = jwt.verify(token, SECRET);
    if (!decoded?.id) 
      return res.status(401).json({ valid: false, message: "Token không hợp lệ" });

    // Kiểm tra user có tồn tại & thiết bị có khớp không
    const { rows } = await db.query(`SELECT email, device_id FROM n_users WHERE id = $1`, [decoded.id]);
    if (!rows.length)
      return res.status(404).json({ valid: false, message: "Tài khoản không tồn tại" });

    const user = rows[0];
    if (user.device_id && user.device_id !== device_id) {
      return res.status(403).json({ valid: false, message: "Thiết bị không hợp lệ" });
    }

    // Token hợp lệ + thiết bị hợp lệ
    return res.json({
      valid: true,
      message: "Token hợp lệ",
      email: user.email,
      deviceId: user.device_id
    });
  } catch (err) {
    console.log("checkToken error:", err.message);
    return res.status(401).json({ valid: false, message: "Token hết hạn hoặc không hợp lệ" });
  }
};