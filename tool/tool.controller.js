/**
 * Tool Controller — Thin Request/Response Layer
 */
const asyncHandler = require('../src/utils/async-handler');
const toolService = require('./tool.service');

/**
 * POST/GET /api/tool/use
 */
exports.useTool = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { gateway, result, round_code } = req.body;

  const toolResult = await toolService.processTool(userId, gateway, result, round_code, req.pkg);
  res.json(toolResult);
});