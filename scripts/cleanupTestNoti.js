// /scripts/cleanupTestNoti.js
require('dotenv').config();
const { Pool } = require('pg');
//node scripts/cleanupTestNoti.js

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
        console.log('🧹 [CleanupTestNoti] Đang xóa dữ liệu test và khôi phục lại cấu hình...');

        // Danh sách email test
        const emails = ['ngothanhlamit@gmail.com', 'dtruong1119@gmail.com'];

        // 1️⃣ Xóa thông báo test khỏi queue
        await pool.query(`
      DELETE FROM n_notifications_queue 
      WHERE email = ANY($1)
    `, [emails]);

        console.log('✅ Đã xóa toàn bộ notification test của 2 user.');

        // 2️⃣ Set lại thời gian delay chuẩn (12h & 24h)
        await pool.query(`UPDATE n_notification_templates SET delay_hours = 12 WHERE code = 'TRIAL_REMIND'`);
        await pool.query(`UPDATE n_notification_templates SET delay_hours = 24 WHERE code = 'TRIAL_LASTCALL'`);

        console.log('✅ Đã khôi phục delay_hours về mặc định (12h & 24h).');
        console.log('🎯 [CleanupTestNoti] Hoàn tất.');
        process.exit(0);
    } catch (err) {
        console.error('❌ [CleanupTestNoti] Lỗi:', err);
        process.exit(1);
    }
})();