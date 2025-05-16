const express = require('express');
const router = express.Router();
const controller = require('./payment.controller');

router.post('/callback', controller.paymentCallback);

module.exports = router;