const express = require('express');
const router = express.Router();
const controller = require('./tool.controller');
const { authMiddleware } = require('../auth/auth.middleware');
const { checkToolUsageLimit } = require('./tool.middleware');


router.post('/use', authMiddleware, checkToolUsageLimit, controller.useTool);

module.exports = router;