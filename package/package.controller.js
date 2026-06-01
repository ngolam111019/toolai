/**
 * Package Controller — Thin Request/Response Layer
 */
const asyncHandler = require('../src/utils/async-handler');
const packageService = require('./package.service');

/** GET /api/package */
exports.getPackages = asyncHandler(async (req, res) => {
  const packages = await packageService.getPackages();
  res.json(packages);
});

/** POST /api/package/upgrade */
exports.upgradePackage = asyncHandler(async (req, res) => {
  const result = await packageService.upgradePackage(req.user.id, req.body.package_id, req.user.platform);
  res.json(result);
});

/** GET /api/package/status */
exports.getPackageStatus = asyncHandler(async (req, res) => {
  const result = await packageService.getPackageStatus(req.user.id, req.user);
  res.json(result);
});