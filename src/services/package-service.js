/**
 * Package Service — Business Logic Layer
 */
const AppError = require('../utils/app-error');
const packageRepo = require('../repositories/package-repository');
const format = require('../utils/format');
const { sendDiscord } = require('../utils/discord-notify');

const PACKAGE_EVENT_CODES = {
  1: 'ON_UPGRADE_TRIAL_PRO',
  2: 'ON_UPGRADE_PREMIUM',
  3: 'ON_PREMIUM_PRO_INACTIVE',
};

/** Lấy danh sách gói */
async function getPackages() {
  return packageRepo.findAllPackages();
}

/**
 * Nâng cấp gói cho user
 * @param {number} userId
 * @param {number} packageId
 * @param {number} userPlatform
 * @returns {Promise<{success, message, package_name, expired_at}>}
 */
async function upgradePackage(userId, packageId, userPlatform) {
  const pkg = await packageRepo.findPackageById(packageId);
  if (!pkg) throw new AppError('Gói không tồn tại', 400, 'PACKAGE_NOT_FOUND');

  // Slot 1 đã giới hạn số lượng
  if (packageId === 1) {
    return {
      success: false,
      message: `❌ Nâng cấp KHÔNG thành công ${pkg.name} (Đã đủ suất). Vui lòng chọn gói khác.`,
    };
  }

  const currentBalance = await packageRepo.getUserBalance(userId);
  if (currentBalance < pkg.price) {
    throw new AppError('Không đủ Xu để nâng cấp', 400, 'INSUFFICIENT_BALANCE');
  }

  await packageRepo.debitUserBalance(userId, pkg.price);
  await packageRepo.insertPurchaseTransaction(userId, pkg.price, pkg.name, pkg.id);
  await packageRepo.deleteUserPackages(userId);

  const expiredAt = pkg.is_lifetime
    ? '9999-12-31'
    : new Date(Date.now() + pkg.duration_days * 86400 * 1000);

  await packageRepo.createUserPackage(userId, pkg.id, expiredAt);

  const eventCode = PACKAGE_EVENT_CODES[pkg.id] || 'ON_SIGNUP';
  await packageRepo.insertUserEventLog(userId, eventCode);

  const { t, d, type } = format.titleDescTypeSenDiscord(true, userId, pkg.name, parseInt(pkg.price), userPlatform, null);
  sendDiscord(type, null, { title: t, description: d, color: 0xFFD700 });

  return { success: true, message: 'Nâng cấp thành công', package_name: pkg.name, expired_at: expiredAt };
}

/**
 * Lấy trạng thái gói hiện tại của user
 */
async function getPackageStatus(userId, user) {
  const trialUsed = await packageRepo.countTrialUsage(userId);
  const isUsedTrial = trialUsed > 0;
  const pkg = await packageRepo.findUserPackageWithDetails(userId);

  if (!pkg) {
    return {
      package: { id: 0, name: 'Chưa có gói hoặc đã hết hạn', max_turns_per_day: 0, turns_used_today: 0, expired_at: null, gateways: [] },
      xu: user.balance_xu || 0,
      email: user.email,
      is_used_trial: isUsedTrial,
      trial_used: trialUsed,
    };
  }

  return {
    package: {
      id: pkg.package_id,
      name: pkg.name,
      max_turns_per_day: pkg.max_turns_per_day,
      turns_used_today: pkg.turns_used_today,
      expired_at: pkg.expired_at,
      gateways: pkg.gateways,
      is_gift: pkg.is_gift,
    },
    xu: user.balance_xu | 0,
    email: user.email,
    is_used_trial: isUsedTrial,
    trial_used: trialUsed,
  };
}

module.exports = { getPackages, upgradePackage, getPackageStatus };
