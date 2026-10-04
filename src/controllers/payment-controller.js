/**
 * Payment Controller — Thin Request/Response Layer
 */
const asyncHandler = require('../utils/async-handler');
const paymentService = require('../services/payment-service');
const AppError = require('../utils/app-error');

/**
 * POST /api/payment/create
 */
exports.createPayment = asyncHandler(async (req, res) => {
  const { amount, package_id } = req.body;
  const result = await paymentService.createPayment(req.user.id, amount, package_id);
  res.json(result);
});

/**
 * POST /api/payment/webhook/sepay
 * Nhan webhook tu Sepay khi co giao dich ngan hang moi
 *
 * Sepay supports 2 auth methods:
 * 1. API Key: Authorization header
 * 2. HMAC-SHA256: x-sepay-signature + x-sepay-timestamp headers
 */
exports.handleSepayWebhook = asyncHandler(async (req, res) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Try HMAC verification first (recommended)
  const signature = req.headers['x-sepay-signature'];
  const timestamp = req.headers['x-sepay-timestamp'];

  if (signature && timestamp) {
    // HMAC mode - need raw body
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!isDev && !paymentService.verifySepayHmac(signature, timestamp, rawBody)) {
      throw new AppError('Invalid signature', 401, 'INVALID_SIGNATURE');
    }
  } else {
    // API Key mode
    const apiKey = req.headers['authorization'];
    if (!isDev && !paymentService.verifySepayApiKey(apiKey)) {
      throw new AppError('Unauthorized', 401, 'INVALID_API_KEY');
    }
  }

  // Parse body if needed (for raw body middleware)
  const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  await paymentService.handleSepayWebhook(webhookData);
  res.json({ success: true });
});
