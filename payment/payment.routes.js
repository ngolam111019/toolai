const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');
const { authMiddleware } = require('../auth/auth.middleware')

router.post('/create', authMiddleware, controller.createPayment);
router.get('/callback', controller.handlePaymentCallback);

module.exports = router;