/**
 * Payment Controller — Thin Request/Response Layer
 */
const asyncHandler = require('../src/utils/async-handler');
const paymentService = require('./payment.service');

/**
 * POST /api/payment/create
 */
exports.createPayment = asyncHandler(async (req, res) => {
  const { amount, package_id } = req.body;
  const result = await paymentService.createPayment(req.user.id, amount, package_id);
  res.json(result);
});

/**
 * GET /api/payment/callback
 * Nhận callback từ payment gateway (GameBank)
 */
exports.handlePaymentCallback = asyncHandler(async (req, res) => {
  await paymentService.handlePaymentCallback(req.query);
  res.json({ ok: true });
});