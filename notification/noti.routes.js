const express = require('express');
const router = express.Router();
const controller = require('./noti.controller');
const { authMiddleware } = require('../auth/auth.middleware');

router.post('/test/noti', authMiddleware, controller.testNoti);
router.post('/noti/schedule', authMiddleware, controller.schedule);
router.post('/noti/cancel', authMiddleware, controller.cancel);


module.exports = router;