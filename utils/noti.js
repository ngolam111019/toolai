const admin = require('firebase-admin');

async function sendPushNotificationToToken(token, data) {
  const message = {
    data: data,
    token: token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✔️ Gửi thành công:', response);
  } catch (error) {
    console.error('❌ Gửi thất bại:', error);
  }
}

module.exports = {
    sendPushNotificationToToken
};