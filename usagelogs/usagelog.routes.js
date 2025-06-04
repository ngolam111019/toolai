const express = require('express');
const router = express.Router();
const usagelogController = require('./usagelog.controller');
const { authMiddleware } = require('../auth/auth.middleware');

router.get('/usage-logs', authMiddleware, usagelogController.getUsageLogs);

module.exports = router;