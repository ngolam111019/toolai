const express = require('express');
const router = express.Router();
const balanceController = require('./balance.controller');
const { authMiddleware } = require('../auth/auth.middleware');

router.get('/logs', authMiddleware, balanceController.getBalanceLogs);

module.exports = router;