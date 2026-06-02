const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth-controller');
const { authMiddleware } = require('../middleware/auth-middleware')

router.post('/login', controller.login);
router.post('/request-otp', controller.requestOtp);
router.post('/verify-otp', controller.verifyOtp);
router.post('/confirm-register', controller.confirmRegister);
router.post('/request-reset', controller.requestReset);
router.post('/verify-reset', controller.verifyResetOtp);
router.post('/send-new-password', controller.sendNewPassword);
router.post('/change-password', authMiddleware, controller.changePassword);
router.post('/fcm-token', authMiddleware, controller.fcmToken);
router.post('/google', controller.authGoogle);
router.post('/save-web-subscription', authMiddleware, controller.saveWebSubscription);
router.post('/check-token', controller.checkToken);

module.exports = router;