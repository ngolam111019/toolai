const axios = require('axios');

const WEBHOOKS = {
  error: process.env.DISCORD_WEBHOOK_ERROR,
  payment: process.env.DISCORD_WEBHOOK_PAYMENT,
  upgrade: process.env.DISCORD_WEBHOOK_UPGRADE,
};

async function sendDiscord(type, message, embed = null) {
  const url = WEBHOOKS[type];
  if (!url) return console.error('❌ Webhook URL chưa khai báo đúng!');

  const data = embed
    ? { embeds: [embed] }
    : { content: message };

  try {
    await axios.post(url, data);
    console.log(`✅ Gửi Discord (${type}) thành công`);
  } catch (e) {
    console.error('❌ Lỗi gửi Discord:', e.message);
  }
}

/**
const { sendDiscord } = require('./discordNotifier');

sendDiscord('error', `🚨 Lỗi hệ thống: ${err.message}\nThời gian: ${new Date().toLocaleString()}`);
 
sendDiscord('payment', null, {
  title: '💰 Nạp Xu thành công',
  description: `**Email:** user@example.com\n**Số tiền:** 500.000 VNĐ`,
  color: 0x00FF00
});

sendDiscord('upgrade', null, {
  title: '📦 Nâng cấp gói VIP',
  description: `**Email:** vip@example.com\n**Gói:** Premium 30 ngày`,
  color: 0xFFD700
});

 */

module.exports = { sendDiscord };