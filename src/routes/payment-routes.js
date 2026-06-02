const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment-controller');
const { authMiddleware } = require('../middleware/auth-middleware')

router.post('/create', authMiddleware, controller.createPayment);
router.get('/callback', controller.handlePaymentCallback);

module.exports = router;