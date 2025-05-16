const express = require('express');
const router = express.Router();
const controller = require('./tool.controller');
const { authMiddleware } = require('../auth/auth.middleware');

router.post('/use', authMiddleware, controller.useTool);

module.exports = router;