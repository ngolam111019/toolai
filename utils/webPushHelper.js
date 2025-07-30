const webpush = require('web-push');

// Cấu hình VAPID (nên đưa key vào biến môi trường .env)
webpush.setVapidDetails(
  'mailto:tooltaixiuai@gmail.com',               // email liên hệ
  process.env.VAPID_PUBLIC_KEY,            // lấy bằng `webpush.generateVAPIDKeys()`
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Gửi thông báo push đến trình duyệt (web push)
 * @param {Object} subscription - Object lấy từ client (PushSubscription)
 * @param {Object} payload - Nội dung thông báo (title, body, url)
 * @returns {Promise<boolean>} - true nếu gửi thành công
 */
async function sendWebPushNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('✅ Web push sent');
    return true;
  } catch (err) {
    console.error('❌ Web push error:', err.message);
    return false;
  }
}

module.exports = {
  sendWebPushNotification
};