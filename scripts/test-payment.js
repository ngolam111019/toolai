/**
 * Test Payment Integration
 * Run: node scripts/test-payment.js
 */
require('dotenv').config();

console.log('=== Payment Config Check ===\n');

// Check MB Bank config
console.log('MB Bank Account:', process.env.MBBANK_ACCOUNT_NO || '(not set)');
console.log('MB Bank Name:', process.env.MBBANK_ACCOUNT_NAME || '(not set)');
console.log('Sepay API Key:', process.env.SEPAY_API_KEY ? '***configured***' : '(not set)');
console.log('');

// Test VietQR URL generation
const { createPayment, parseTransferContent } = require('../src/services/payment-service');

console.log('=== Test VietQR URL ===\n');

const testUserId = 123;
const testAmount = 50000;

// Build QR URL manually to test
const transferCode = require('crypto').randomBytes(3).toString('hex').toUpperCase();
const content = `UID${testUserId} ${transferCode}`;
const params = new URLSearchParams({
  amount: testAmount.toString(),
  addInfo: content,
  accountName: process.env.MBBANK_ACCOUNT_NAME || 'TEST',
});
const qrUrl = `https://img.vietqr.io/image/MB-${process.env.MBBANK_ACCOUNT_NO || '0000000000'}-compact2.png?${params}`;

console.log('Sample QR URL:', qrUrl);
console.log('Transfer Content:', content);
console.log('');

// Test parse transfer content
console.log('=== Test Parse Transfer Content ===\n');

const testCases = [
  'UID123 ABC123',
  'uid456 def456',
  'UID789 GHIJKL invalid',
  'random text',
  'UID999 A1B2C3 extra text',
];

testCases.forEach(tc => {
  const result = parseTransferContent(tc);
  console.log(`"${tc}" =>`, result || 'null');
});

console.log('\n=== Webhook Endpoint ===');
console.log('POST /api/payment/webhook/sepay');
console.log('Header: Authorization: <SEPAY_API_KEY>');
console.log('Body: { transferAmount, content, transferType, ... }');
