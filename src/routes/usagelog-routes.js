const express = require('express');
const router = express.Router();
const usagelogController = require('../controllers/usagelog-controller');
const { authMiddleware } = require('../middleware/auth-middleware');

router.get('/usage-logs', authMiddleware, usagelogController.getUsageLogs);

module.exports = router;