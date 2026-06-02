/**
 * Package Service — Unit Tests
 */

jest.mock('../../../src/repositories/package-repository');
jest.mock('../../../src/utils/discord-notify', () => ({
  sendDiscord: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/format', () => ({
  formatWithUnit: jest.fn((amount, unit) => `${amount} ${unit}`),
  titleDescTypeSenDiscord: jest.fn(() => ({ t: 'title', d: 'desc', type: 'upgrade' })),
}));

const packageRepo = require('../../../src/repositories/package-repository');
const packageService = require('../../../src/services/package-service');
const AppError = require('../../../src/utils/app-error');

describe('packageService.getPackages', () => {
  it('should return all packages from repo', async () => {
    const mockPkgs = [{ id: 1, name: 'Basic' }, { id: 2, name: 'Pro' }];
    packageRepo.findAllPackages.mockResolvedValue(mockPkgs);

    const result = await packageService.getPackages();

    expect(result).toEqual(mockPkgs);
    expect(packageRepo.findAllPackages).toHaveBeenCalledTimes(1);
  });
});

describe('packageService.upgradePackage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw PACKAGE_NOT_FOUND when invalid packageId', async () => {
    packageRepo.findPackageById.mockResolvedValue(null);

    await expect(packageService.upgradePackage(1, 999, 0))
      .rejects.toMatchObject({ code: 'PACKAGE_NOT_FOUND' });
  });

  it('should return failure for package_id=1 (slot full)', async () => {
    packageRepo.findPackageById.mockResolvedValue({ id: 1, name: 'Limited' });

    const result = await packageService.upgradePackage(1, 1, 0);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Đã đủ suất');
  });

  it('should throw INSUFFICIENT_BALANCE when not enough xu', async () => {
    packageRepo.findPackageById.mockResolvedValue({ id: 2, name: 'Pro', price: 500000 });
    packageRepo.getUserBalance.mockResolvedValue(100000);

    await expect(packageService.upgradePackage(1, 2, 0))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('should upgrade successfully when enough balance', async () => {
    const pkg = { id: 2, name: 'Pro', price: 300000, is_lifetime: false, duration_days: 30 };
    packageRepo.findPackageById.mockResolvedValue(pkg);
    packageRepo.getUserBalance.mockResolvedValue(500000);
    packageRepo.debitUserBalance.mockResolvedValue(undefined);
    packageRepo.insertPurchaseTransaction.mockResolvedValue(undefined);
    packageRepo.deleteUserPackages.mockResolvedValue(undefined);
    packageRepo.createUserPackage.mockResolvedValue(undefined);
    packageRepo.insertUserEventLog.mockResolvedValue(undefined);

    const result = await packageService.upgradePackage(1, 2, 0);

    expect(result.success).toBe(true);
    expect(result.package_name).toBe('Pro');
    expect(packageRepo.debitUserBalance).toHaveBeenCalledWith(1, 300000);
    expect(packageRepo.deleteUserPackages).toHaveBeenCalledWith(1);
    expect(packageRepo.insertUserEventLog).toHaveBeenCalledWith(1, 'ON_UPGRADE_PREMIUM');
  });
});

describe('packageService.getPackageStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return default when no package', async () => {
    packageRepo.countTrialUsage.mockResolvedValue(0);
    packageRepo.findUserPackageWithDetails.mockResolvedValue(null);
    const user = { balance_xu: 100, email: 'a@b.com' };

    const result = await packageService.getPackageStatus(1, user);

    expect(result.package.id).toBe(0);
    expect(result.package.name).toContain('Chưa có gói');
    expect(result.xu).toBe(100);
    expect(result.email).toBe('a@b.com');
  });

  it('should return package details when active', async () => {
    packageRepo.countTrialUsage.mockResolvedValue(2);
    packageRepo.findUserPackageWithDetails.mockResolvedValue({
      package_id: 2,
      name: 'Pro',
      max_turns_per_day: 20,
      turns_used_today: 5,
      expired_at: '2026-07-01',
      gateways: ['Zon88'],
      is_gift: false,
    });
    const user = { balance_xu: 200, email: 'a@b.com' };

    const result = await packageService.getPackageStatus(1, user);

    expect(result.package.id).toBe(2);
    expect(result.package.name).toBe('Pro');
    expect(result.is_used_trial).toBe(true);
    expect(result.trial_used).toBe(2);
  });
});
