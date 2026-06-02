const admin = require('firebase-admin');
const { sendWebPushNotification } = require('./web-push-helper');

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

async function pushNoti(user, data){
  console.log(user);
  if(user) {
    if(user.platform == 0 && user.fcm_token){
      await sendPushNotificationToToken(user.fcm_token, data);
    }
    
    if(user.platform == 1 && user.web_push_subscription) {
      await sendWebPushNotification (user.web_push_subscription, data);
    }
  }
}

module.exports = {
    pushNoti
};