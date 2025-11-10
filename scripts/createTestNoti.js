// /scripts/createTestNoti.js
require('dotenv').config();
const { Pool } = require('pg');
//node scripts/createTestNoti.js


// ✅ Cấu hình kết nối PostgreSQL (cloud)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('connect', async (client) => {
    await client.query(`SET TIME ZONE 'Asia/Ho_Chi_Minh';`);
});
(async () => {
    try {
        console.log('🚀 [CreateTestNoti] Bắt đầu tạo dữ liệu test...');

        // Danh sách email test
        const emails = ['ngothanhlamit@gmail.com', 'dtruong1119@gmail.com'];

        // 1️⃣ Cập nhật thời gian delay cho template test (6 phút & 12 phút)
        await pool.query(`UPDATE n_notification_templates SET delay_hours = 0.1 WHERE code = 'TRIAL_REMIND'`);
        await pool.query(`UPDATE n_notification_templates SET delay_hours = 0.2 WHERE code = 'TRIAL_LASTCALL'`);

        // 2️⃣ Lấy template hiện tại
        const templates = await pool.query(`
      SELECT id, code, title, message, btn_text, screen_redirect, delay_hours 
      FROM n_notification_templates 
      WHERE code IN ('TRIAL_REMIND', 'TRIAL_LASTCALL')
    `);

        // 3️⃣ Tạo notification queue test cho 2 user
        for (const email of emails) {
            const userRes = await pool.query('SELECT id, email, platform FROM n_users WHERE email=$1', [email]);
            const user = userRes.rows[0];
            if (!user) {
                console.log(`⚠️  User ${email} chưa có trong DB, bỏ qua.`);
                continue;
            }

            for (const tpl of templates.rows) {
                await pool.query(`
          INSERT INTO n_notifications_queue 
          (user_id, email, platform, title, message, btn_text, screen_redirect, send_after, template_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + interval '${tpl.delay_hours} hours', $8)
          ON CONFLICT (user_id, template_id) DO NOTHING
        `, [
                    user.id,
                    user.email,
                    user.platform,
                    tpl.title,
                    tpl.message,
                    tpl.btn_text,
                    tpl.screen_redirect,
                    tpl.id
                ]);
            }

            console.log(`✅ Đã tạo notification test cho ${email}`);
        }

        console.log('🎉 [CreateTestNoti] Tạo dữ liệu test hoàn tất.');
        process.exit(0);
    } catch (err) {
        console.error('❌ [CreateTestNoti] Lỗi:', err);
        process.exit(1);
    }
})();