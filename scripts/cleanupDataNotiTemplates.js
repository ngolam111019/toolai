// /scripts/cleanupDataNotiTemplates.js
require('dotenv').config();
const { Pool } = require('pg');
// node scripts/cleanupDataNotiTemplates.js

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
        console.log('🧹 [cleanupDataNotiTemplates] Đang xóa toàn bộ notification templates...');

        await pool.query(`DELETE FROM n_notification_templates`);
        console.log('✅ Đã xóa toàn bộ dữ liệu trong n_notification_templates.');

        // (Tùy chọn) Reset lại ID đếm tự động
        await pool.query(`ALTER SEQUENCE n_notification_templates_id_seq RESTART WITH 1`);
        console.log('🔁 Đã reset lại sequence ID.');

        process.exit(0);
    } catch (err) {
        console.error('❌ [cleanupDataNotiTemplates] Lỗi:', err);
        process.exit(1);
    }
})();