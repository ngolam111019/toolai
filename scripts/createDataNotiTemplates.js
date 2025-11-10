// /scripts/createDataNotiTemplates.js
require('dotenv').config();
const { Pool } = require('pg');
//node scripts/createDataNotiTemplates.js

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
        console.log('🚀 [createDataNotiTemplates] Bắt đầu thêm dữ liệu notification templates...');

        // Xóa dữ liệu cũ nếu có
        await pool.query(`DELETE FROM n_notification_templates`);

        // Danh sách template
        const templates = [
            // --- CHUỖI 1: ON_SIGNUP ---
            { code: 'SIGNUP_WELCOME', trigger_event: 'ON_SIGNUP', delay_hours: 0, title: '🎁 Bạn được tặng 5 lượt dùng thử miễn phí!', message: 'Bắt đầu trải nghiệm Tool AI để thấy độ chính xác trên 80%.', btn_text: 'Dùng thử ngay', screen_redirect: 'tool' },
            { code: 'SIGNUP_REMIND', trigger_event: 'ON_SIGNUP', delay_hours: 6, title: 'Người chơi khác đang nâng cấp Premium để tăng tỷ lệ thắng!', message: 'Ưu đãi 50% chỉ còn hôm nay, thử ngay trước khi hết lượt!', btn_text: 'Nâng cấp Premium', screen_redirect: 'package' },
            { code: 'SIGNUP_LASTCALL', trigger_event: 'ON_SIGNUP', delay_hours: 12, title: '🔥 Còn vài giờ để nhận Premium giảm 50%', message: 'Ưu đãi chỉ dành cho người dùng đăng ký trong ngày hôm nay.', btn_text: 'Nâng cấp ngay', screen_redirect: 'package' },
            { code: 'SIGNUP_FINAL', trigger_event: 'ON_SIGNUP', delay_hours: 24, title: 'Cơ hội cuối cùng để nâng cấp Premium với 1000k', message: 'Ưu đãi sắp kết thúc, đừng bỏ lỡ quyền truy cập đầy đủ!', btn_text: 'Nâng cấp ngay', screen_redirect: 'package' },

            // --- CHUỖI 2: ON_UPGRADE_TRIAL_PRO ---
            { code: 'TRIALPRO_WELCOME', trigger_event: 'ON_UPGRADE_TRIAL_PRO', delay_hours: 0, title: 'Chào mừng bạn đến với Dùng thử Pro!', message: 'Trải nghiệm đầy đủ hơn, nhưng bạn vẫn chưa có đặc quyền Premium.', btn_text: 'Tìm hiểu Premium', screen_redirect: 'package' },
            { code: 'TRIALPRO_REMIND', trigger_event: 'ON_UPGRADE_TRIAL_PRO', delay_hours: 24, title: 'Trải nghiệm Premium – khác biệt thật sự!', message: 'Nâng cấp lên Premium để mở tất cả cổng game và 100 lượt/ngày.', btn_text: 'Nâng cấp Premium', screen_redirect: 'package' },
            { code: 'TRIALPRO_FINAL', trigger_event: 'ON_UPGRADE_TRIAL_PRO', delay_hours: 48, title: 'Ưu đãi Premium giảm 50% chỉ trong hôm nay!', message: 'Cơ hội nâng cấp với giá 1000k sắp hết.', btn_text: 'Nâng cấp ngay', screen_redirect: 'package' },

            // --- CHUỖI 3: ON_UPGRADE_PREMIUM ---
            { code: 'PREMIUM_UPSELL1', trigger_event: 'ON_UPGRADE_PREMIUM', delay_hours: 24, title: '💎 Đặc quyền dành riêng cho thành viên Premium', message: 'Chúng tôi mở ưu đãi giảm 60% gói Premium Pro trong 24h.', btn_text: 'Xem gói Premium Pro', screen_redirect: 'package' },
            { code: 'PREMIUM_UPSELL2', trigger_event: 'ON_UPGRADE_PREMIUM', delay_hours: 48, title: 'Người chơi Premium đã nâng cấp Pro – bạn thì sao?', message: '200 lượt/ngày, 365 ngày dùng liên tiếp – tiết kiệm 60%.', btn_text: 'Nâng cấp Pro', screen_redirect: 'package' },
            { code: 'PREMIUM_UPSELL3', trigger_event: 'ON_UPGRADE_PREMIUM', delay_hours: 72, title: 'Cơ hội cuối cùng để nhận ưu đãi Premium Pro 60%', message: 'Ưu đãi sắp hết, kích hoạt ngay để duy trì hiệu quả dự đoán.', btn_text: 'Nâng cấp ngay', screen_redirect: 'package' },

            // --- CHUỖI 4: ON_PREMIUM_PRO_INACTIVE ---
            { code: 'PRO_INACTIVE_1', trigger_event: 'ON_PREMIUM_PRO_INACTIVE', delay_hours: 72, title: '😔 Bạn chưa đạt kết quả mong muốn?', message: 'Tool AI liên tục được cập nhật. Hãy thử lại bản Dùng thử Pro để điều chỉnh chiến lược chơi.', btn_text: 'Thử lại Dùng thử Pro', screen_redirect: 'package' },
            { code: 'PRO_INACTIVE_2', trigger_event: 'ON_PREMIUM_PRO_INACTIVE', delay_hours: 78, title: 'Cập nhật mới giúp tăng tỷ lệ chính xác, bạn muốn thử lại không?', message: 'Dùng lại bản Dùng thử Pro miễn phí 24h để kiểm chứng hiệu quả mới.', btn_text: 'Kích hoạt Dùng thử Pro', screen_redirect: 'package' },
            { code: 'PRO_INACTIVE_3', trigger_event: 'ON_PREMIUM_PRO_INACTIVE', delay_hours: 84, title: 'Chúng tôi mở lại Dùng thử Pro 24h cho bạn!', message: 'Chỉ dành cho người dùng Premium Pro chưa đạt hiệu quả – click để kích hoạt.', btn_text: 'Dùng thử lại', screen_redirect: 'package' }
        ];

        for (const tpl of templates) {
            await pool.query(`
        INSERT INTO n_notification_templates (code, title, message, btn_text, screen_redirect, delay_hours, trigger_event, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
      `, [tpl.code, tpl.title, tpl.message, tpl.btn_text, tpl.screen_redirect, tpl.delay_hours, tpl.trigger_event]);
        }

        console.log(`✅ Đã tạo ${templates.length} notification templates thành công!`);
        process.exit(0);
    } catch (err) {
        console.error('❌ [createDataNotiTemplates] Lỗi:', err);
        process.exit(1);
    }
})();