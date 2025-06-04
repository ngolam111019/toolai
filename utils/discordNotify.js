// discordNotifier.js
const axios = require('axios');

const WEBHOOKS = {
  error: 'https://discord.com/api/webhooks/1377945566008311849/o3bmXWy8QKqX10QC1cKdvM0Jp44vJk3wIZVAkbQkXQ8m_8jrtBm7nIhdTPF3o85EzFWb',
  payment: 'https://discord.com/api/webhooks/1377945715195646013/elbRrh8Op0p5i4WKx0RQwlhGi2hZEeEsAKaDBpDm9nRLoiRJq1S9VU91Eyz6mYNjzFGD',
  upgrade: 'https://discord.com/api/webhooks/1377945785454432327/OFw4g1kwHjl51nUzUJqpKCPGBu1s4VjEBzvxN9XygQX67yHZs_nhMShwXqT3IOjpHEHu',
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