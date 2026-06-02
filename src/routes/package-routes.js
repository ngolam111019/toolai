const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const controller = require('../controllers/package-controller');
const { authMiddleware } = require('../middleware/auth-middleware')

// GET /api/packages
router.get('/packages', controller.getPackages);

// GET /api/package/status
router.get('/status', authMiddleware, controller.getPackageStatus);

router.post('/upgrade', authMiddleware, controller.upgradePackage);


module.exports = router;