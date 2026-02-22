require('dotenv').config();
const { Pool } = require('pg');

// ✅ Cấu hình kết nối PostgreSQL (cloud)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ❗ THAY EMAIL CẦN XÓA Ở ĐÂY
const emailToDelete = 'tooltaixiuai@gmail.com';

(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Tìm user theo email
    const resUser = await client.query(
      'SELECT id FROM public.n_users WHERE email = $1',
      [emailToDelete]
    );

    if (resUser.rows.length === 0) {
      console.log('❌ Không tìm thấy user với email:', emailToDelete);
      await client.query('ROLLBACK');
      return;
    }

    const userId = resUser.rows[0].id;
    console.log('✅ Đã tìm thấy user_id:', userId);

    // Xóa dữ liệu liên quan
    await client.query('DELETE FROM public.n_user_packages WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_transactions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_notifications_queue WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_user_event_logs WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_tool_usage_logs WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_user_notifications WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM public.n_users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    console.log('✅ Đã xóa toàn bộ dữ liệu của user', emailToDelete);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi trong quá trình xóa:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
})();