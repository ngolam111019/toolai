const express = require('express');
const router = express.Router();
const controller = require('./noti.controller');
const { authMiddleware } = require('../auth/auth.middleware');

// Test gửi noti
router.post('/test/noti', authMiddleware, controller.testNoti);

// Lấy noti incremental sync
router.get('/list', authMiddleware, controller.getNotifications);

// Lấy noti theo page
router.get('/page', authMiddleware, controller.getNotificationsPage);

// Đánh dấu đã đọc
router.post('/mark-read', authMiddleware, controller.markRead);

module.exports = router;