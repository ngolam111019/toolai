/**
 * Tool Service — Business Logic Layer
 *
 * Chứa logic xử lý tool prediction:
 * - Kiểm tra quyền truy cập gateway
 * - Tính toán kết quả dự đoán (Tài/Xỉu)
 * - Ghi log usage
 * - Trừ lượt
 */
const AppError = require('../src/utils/app-error');
const toolRepo = require('./tool.repository');
const format = require('../utils/format');

const GATEWAY_DEMO = process.env.GATEWAY_DEMO || 'Zon88';

/**
 * Tính kết quả dự đoán Tài/Xỉu dựa theo result
 * @param {number|null} result - Tổng xúc xắc (3-18) hoặc null
 * @returns {'Tài'|'Xỉu'}
 */
function calculatePrediction(result) {
  if (result >= 3 && result <= 10) return 'Xỉu';
  if (result >= 11 && result <= 18) return 'Tài';
  return Math.random() < 0.5 ? 'Tài' : 'Xỉu';
}

/**
 * Xử lý logic kiểm tra và reset lượt hàng ngày
 * @param {object} pkg - Package object từ DB
 * @returns {Promise<number>} turnsUsed sau khi reset nếu cần
 */
async function getTurnsUsedWithDailyReset(pkg) {
  const today = format.getTodayVN();
  const lastReset = pkg.last_turn_reset
    ? new Date(pkg.last_turn_reset).toISOString().slice(0, 10)
    : today;

  let turnsUsed = pkg.turns_used_today;

  // Gói không phải trial (id !== 0): reset lượt khi sang ngày mới
  if (pkg.id !== 0 && lastReset !== today) {
    await toolRepo.resetDailyTurns(pkg.id);
    turnsUsed = 0;
  }

  return turnsUsed;
}

/**
 * Kiểm tra user có quyền dùng tool không và gắn thông tin pkg vào context
 * Dùng bởi middleware checkToolUsageLimit
 *
 * @param {number} userId
 * @returns {Promise<{id, max_turns, turns_used, allowed_gateways}>} pkg info
 */
async function validateToolAccess(userId) {
  const pkg = await toolRepo.findActiveUserPackage(userId);

  if (!pkg) {
    throw new AppError('Gói đã hết hạn, vui lòng nâng cấp để sử dụng tiếp', 403, 'PACKAGE_EXPIRED');
  }

  const turnsUsed = await getTurnsUsedWithDailyReset(pkg);

  // Gói trial (id = 0): chặn ngay khi đủ max_turns
  if (pkg.id === 0 && turnsUsed === pkg.max_turns_per_day) {
    throw new AppError(
      `Bạn đã dùng hết ${pkg.max_turns_per_day} lượt dùng thử. Vui lòng nâng cấp để sử dụng tiếp.`,
      403,
      'TRIAL_EXHAUSTED'
    );
  }

  if (turnsUsed >= pkg.max_turns_per_day) {
    throw new AppError('Bạn đã hết lượt chơi hôm nay', 403, 'TURNS_EXHAUSTED');
  }

  return {
    id: pkg.id,
    max_turns: pkg.max_turns_per_day,
    turns_used: turnsUsed,
    allowed_gateways: pkg.gateways,
  };
}

/**
 * Thực hiện dự đoán tool và ghi log
 *
 * @param {number} userId
 * @param {string} gateway
 * @param {number|null} result - Tổng xúc xắc
 * @param {string|null} roundCode
 * @param {object} pkgInfo - Từ validateToolAccess()
 * @returns {Promise<{result: string, turns_left: number}>}
 */
async function processTool(userId, gateway, result, roundCode, pkgInfo) {
  // Kiểm tra quyền truy cập gateway
  if (!gateway) {
    throw new AppError('Thiếu tham số gateway', 400, 'MISSING_GATEWAY');
  }

  if (pkgInfo.allowed_gateways?.includes && !pkgInfo.allowed_gateways.includes(gateway)) {
    throw new AppError(
      'Cổng này không thuộc gói bạn đang dùng. Vui lòng nâng cấp gói cao hơn.',
      403,
      'GATEWAY_NOT_ALLOWED'
    );
  }

  // Tính kết quả
  const isDemoGateway = gateway === GATEWAY_DEMO;
  const hasSufficientData = isDemoGateway && result && roundCode;

  const finalResult = hasSufficientData
    ? calculatePrediction(result)
    : calculatePrediction(null); // Random nếu thiếu data

  // Ghi log nếu đủ điều kiện (chỉ demo gateway với đủ thông tin)
  if (hasSufficientData) {
    await toolRepo.insertUsageLog(userId, gateway, finalResult, roundCode);
  }

  // Trừ lượt
  if (pkgInfo.id) {
    await toolRepo.incrementTurnsUsed(pkgInfo.id);
  }

  const turnsLeft = pkgInfo.max_turns - (pkgInfo.turns_used + 1);
  const displayResult = roundCode ? `#${roundCode} - ${finalResult}` : finalResult;

  return { result: displayResult, turns_left: turnsLeft };
}

module.exports = {
  validateToolAccess,
  processTool,
};
