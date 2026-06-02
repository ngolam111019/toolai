const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balance-controller');
const { authMiddleware } = require('../middleware/auth-middleware');

router.get('/logs', authMiddleware, balanceController.getBalanceLogs);

module.exports = router;