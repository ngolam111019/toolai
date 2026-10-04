/**
 * Test Create Payment Workflow
 *
 * Flow:
 * 1. Login để lấy JWT token
 * 2. Gọi POST /api/payment/create
 * 3. Hiển thị QR data
 *
 * Usage: node scripts/test-create-payment.js [email] [password] [amount]
 */
require('dotenv').config();

const http = require('http');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// Test params
const email = process.argv[2] || 'test@example.com';
const password = process.argv[3] || 'password123';
const amount = parseInt(process.argv[4]) || 50000;
const deviceId = 'test-device-001';

function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const url = new URL(path, BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Test Create Payment Workflow ===\n');
  console.log('Config:');
  console.log('  Email:', email);
  console.log('  Amount:', amount.toLocaleString(), 'VND');
  console.log('  Device ID:', deviceId);
  console.log('');

  // Step 1: Login
  console.log('Step 1: Login...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email,
    password,
    device_id: deviceId,
  });

  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.log('❌ Login failed:', loginRes.data);
    console.log('\nHint: Tạo user test trong DB hoặc dùng email/password có sẵn');
    console.log('Usage: node scripts/test-create-payment.js <email> <password> [amount]');
    process.exit(1);
  }

  const token = loginRes.data.token;
  console.log('✅ Login success, token:', token.substring(0, 20) + '...');
  console.log('');

  // Step 2: Create Payment
  console.log('Step 2: Create Payment...');
  const paymentRes = await makeRequest('POST', '/api/payment/create', {
    amount,
    package_id: null,
  }, token);

  if (paymentRes.status !== 200) {
    console.log('❌ Create payment failed:', paymentRes.data);
    process.exit(1);
  }

  const payment = paymentRes.data;
  console.log('✅ Payment created!\n');

  // Display result
  console.log('=== Payment Details ===');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│ Transaction ID:', payment.tranid);
  console.log('│ Bank:', payment.bank);
  console.log('│ Account:', payment.account_number);
  console.log('│ Account Name:', payment.account_name);
  console.log('│ Amount:', amount.toLocaleString(), 'VND');
  console.log('│ Content:', payment.content);
  console.log('│ Expires:', payment.expired_at);
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
  console.log('QR URL:');
  console.log(payment.qr_url);
  console.log('');

  // Extract transfer code for webhook test
  const match = payment.content.match(/([A-F0-9]{6})$/);
  if (match) {
    console.log('=== Next Step: Test Webhook ===');
    console.log('Run this to simulate Sepay webhook:');
    console.log(`  node scripts/simulate-sepay-webhook.js ${match[1]} ${amount}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
