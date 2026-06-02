const express = require('express');
const router = express.Router();
const controller = require('../controllers/tool-controller');
const { authMiddleware } = require('../middleware/auth-middleware');
const { checkToolUsageLimit } = require('../middleware/tool-middleware');


router.post('/use', authMiddleware, checkToolUsageLimit, controller.useTool);
router.get('/use', authMiddleware, controller.useTool);

module.exports = router;