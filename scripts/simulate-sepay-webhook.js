/**
 * Simulate Sepay Webhook - Test local
 *
 * Sepay Webhook payload format:
 * {
 *   "id": 93,                           // Sepay transaction ID
 *   "gateway": "MBBank",                // Bank name
 *   "transactionDate": "2024-07-11 10:11:39",
 *   "accountNumber": "0123456789",      // Your bank account
 *   "code": null,                       // VA code (if any)
 *   "content": "UID1 ABC123",           // Transfer content
 *   "transferType": "in",               // "in" or "out"
 *   "transferAmount": 50000,            // Amount in VND
 *   "accumulated": 1500000,             // Account balance after
 *   "subAccount": null,
 *   "referenceCode": "FT123456789",     // Bank reference
 *   "description": "UID1 ABC123"
 * }
 *
 * Usage:
 *   1. Start server: npm start
 *   2. Create payment to get transfer_code
 *   3. Run: node scripts/simulate-sepay-webhook.js <transfer_code> [amount] [user_id]
 *
 * Example:
 *   node scripts/simulate-sepay-webhook.js ABC123 50000 1
 */
require('dotenv').config();

const http = require('http');
const crypto = require('crypto');

const transferCode = process.argv[2];
const amount = parseInt(process.argv[3]) || 50000;
const userId = process.argv[4] || '1';

if (!transferCode) {
  console.log('=== Sepay Webhook Simulator ===\n');
  console.log('Usage: node scripts/simulate-sepay-webhook.js <transfer_code> [amount] [user_id]');
  console.log('\nExample:');
  console.log('  node scripts/simulate-sepay-webhook.js ABC123 50000 1');
  console.log('\nSteps:');
  console.log('  1. Start server: npm start');
  console.log('  2. Create payment: POST /api/payment/create');
  console.log('  3. Get transfer_code from response content field');
  console.log('  4. Run this script with that code');
  process.exit(1);
}

// Sepay webhook payload (exact format from docs)
const webhookData = {
  id: Math.floor(Math.random() * 100000),
  gateway: 'MBBank',
  transactionDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
  accountNumber: process.env.MBBANK_ACCOUNT_NO || '0123456789',
  code: null,
  content: `UID${userId} ${transferCode}`,
  transferType: 'in',
  transferAmount: amount,
  accumulated: 1000000 + amount,
  subAccount: null,
  referenceCode: `FT${Date.now()}`,
  description: `UID${userId} ${transferCode}`,
};

const postData = JSON.stringify(webhookData);
const port = process.env.PORT || 3000;

// Prepare headers
const headers = {
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(postData),
};

// Add auth header based on config
if (process.env.SEPAY_WEBHOOK_SECRET) {
  // HMAC mode
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${postData}`;
  const signature = 'sha256=' + crypto
    .createHmac('sha256', process.env.SEPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  headers['x-sepay-signature'] = signature;
  headers['x-sepay-timestamp'] = timestamp;
  console.log('Auth: HMAC-SHA256');
} else if (process.env.SEPAY_API_KEY) {
  // API Key mode
  headers['Authorization'] = process.env.SEPAY_API_KEY;
  console.log('Auth: API Key');
} else {
  console.log('Auth: None (dev mode)');
}

console.log('\n=== Simulating Sepay Webhook ===\n');
console.log('Payload:');
console.log(JSON.stringify(webhookData, null, 2));
console.log('');
console.log(`POST http://localhost:${port}/api/payment/webhook/sepay`);
console.log('');

const options = {
  hostname: 'localhost',
  port: port,
  path: '/api/payment/webhook/sepay',
  method: 'POST',
  headers: headers,
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response:', data);
    }

    if (res.statusCode === 200) {
      console.log('\n✅ Webhook processed successfully!');
      console.log(`   User ${userId} should now have +${amount.toLocaleString()} Xu`);
    } else {
      console.log('\n❌ Webhook failed');
    }
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Error: ${e.message}`);
  console.log('\nMake sure server is running: npm start');
});

req.write(postData);
req.end();
