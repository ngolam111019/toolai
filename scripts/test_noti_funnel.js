// scripts/test_noti_funnel.js
require("dotenv").config();
const { Pool } = require("pg");

// Import 2 module chính
const { scheduleNotificationsFromEvents } = require("../notification/noti.scheduler.events");
const { sendPendingNotifications } = require("../notification/noti.sender");

// DB connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', async (client) => {
  await client.query(`SET TIME ZONE 'Asia/Ho_Chi_Minh';`);
});

// ========== CONFIG TEST USER ==========
const TEST_USER_ID = 31542;   // đổi theo user của bạn
const TEST_EVENT = "ON_SIGNUP_TRIAL_USED"; // đổi event để test funnel
// ON_SIGNUP
// ON_SIGNUP_TRIAL_USED
// ON_UPGRADE_TRIAL_PRO
// ON_UPGRADE_PREMIUM
// ON_PREMIUM_PRO_INACTIVE

// ========== INSERT EVENT ==========
async function insertTestEvent() {
  console.log(`\n🧪 Thêm event test: ${TEST_EVENT}...`);

  await pool.query(`
    INSERT INTO n_user_event_logs (user_id, event_code)
    VALUES ($1, $2)
  `, [TEST_USER_ID, TEST_EVENT]);

  console.log("✅ Đã thêm event test!");
}

// ========== SHOW QUEUE ==========
async function showQueue() {
  const rs = await pool.query(`
    SELECT id, trigger_event, title, send_after, status
    FROM n_notifications_queue
    WHERE user_id = $1
    ORDER BY id DESC
  `, [TEST_USER_ID]);

  console.table(rs.rows);
}

// ========== MAIN TEST FLOW ==========
(async () => {
  try {
    console.log("========== 🧪 TEST NOTI FUNNEL ==========");

    await insertTestEvent();

    console.log("\n⏳ Chạy scheduler (tạo queue)...");
    await scheduleNotificationsFromEvents();

    console.log("\n📬 Queue sau khi schedule:");
    await showQueue();

    console.log("\n🚀 Gửi thử notification...");
    await sendPendingNotifications();

    console.log("\n📬 Queue sau khi gửi:");
    await showQueue();

    console.log("\n🎉 Test xong!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Lỗi test:", err);
    process.exit(1);
  }
})();