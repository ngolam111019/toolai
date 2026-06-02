/**
 * Tool Service — Unit Tests
 *
 * Mock: tool.repository, format
 * Test: validateToolAccess(), processTool(), calculatePrediction logic
 */

jest.mock('../../../src/repositories/tool-repository');
jest.mock('../../../src/utils/format', () => ({
  getTodayVN: jest.fn().mockReturnValue('2026-06-01'),
}));

// Set env before require
process.env.GATEWAY_DEMO = 'Zon88';

const toolRepo = require('../../../src/repositories/tool-repository');
const toolService = require('../../../src/services/tool-service');
const AppError = require('../../../src/utils/app-error');

// ─── validateToolAccess() ────────────────────────────────────────────────────
describe('toolService.validateToolAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw PACKAGE_EXPIRED when no active package', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue(null);

    await expect(toolService.validateToolAccess(1))
      .rejects.toMatchObject({ code: 'PACKAGE_EXPIRED', statusCode: 403 });
  });

  it('should throw TRIAL_EXHAUSTED when trial max reached', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue({
      id: 0, // trial
      max_turns_per_day: 5,
      turns_used_today: 5,
      last_turn_reset: '2026-06-01',
      gateways: ['Zon88'],
    });

    await expect(toolService.validateToolAccess(1))
      .rejects.toMatchObject({ code: 'TRIAL_EXHAUSTED', statusCode: 403 });
  });

  it('should throw TURNS_EXHAUSTED when all turns used', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue({
      id: 2, // paid package
      max_turns_per_day: 10,
      turns_used_today: 10,
      last_turn_reset: '2026-06-01',
      gateways: ['Zon88'],
    });

    await expect(toolService.validateToolAccess(1))
      .rejects.toMatchObject({ code: 'TURNS_EXHAUSTED', statusCode: 403 });
  });

  it('should reset daily turns when new day for paid package', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue({
      id: 2,
      max_turns_per_day: 10,
      turns_used_today: 8,
      last_turn_reset: '2026-05-31', // yesterday
      gateways: ['Zon88'],
    });
    toolRepo.resetDailyTurns.mockResolvedValue(undefined);

    const result = await toolService.validateToolAccess(1);

    expect(toolRepo.resetDailyTurns).toHaveBeenCalledWith(2);
    expect(result.turns_used).toBe(0); // reset to 0
  });

  it('should NOT reset daily turns for trial package (id=0)', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue({
      id: 0,
      max_turns_per_day: 5,
      turns_used_today: 2,
      last_turn_reset: '2026-05-31',
      gateways: ['Zon88'],
    });

    const result = await toolService.validateToolAccess(1);

    expect(toolRepo.resetDailyTurns).not.toHaveBeenCalled();
    expect(result.turns_used).toBe(2);
  });

  it('should return package info when access valid', async () => {
    toolRepo.findActiveUserPackage.mockResolvedValue({
      id: 2,
      max_turns_per_day: 10,
      turns_used_today: 3,
      last_turn_reset: '2026-06-01',
      gateways: ['Zon88', 'Other'],
    });

    const result = await toolService.validateToolAccess(1);

    expect(result).toEqual({
      id: 2,
      max_turns: 10,
      turns_used: 3,
      allowed_gateways: ['Zon88', 'Other'],
    });
  });
});

// ─── processTool() ──────────────────────────────────────────────────────────
describe('toolService.processTool', () => {
  const PKG_INFO = { id: 2, max_turns: 10, turns_used: 3, allowed_gateways: ['Zon88'] };

  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_GATEWAY when gateway empty', async () => {
    await expect(toolService.processTool(1, null, null, null, PKG_INFO))
      .rejects.toMatchObject({ code: 'MISSING_GATEWAY' });
  });

  it('should throw GATEWAY_NOT_ALLOWED when not in allowed list', async () => {
    await expect(toolService.processTool(1, 'Other', null, null, PKG_INFO))
      .rejects.toMatchObject({ code: 'GATEWAY_NOT_ALLOWED', statusCode: 403 });
  });

  it('should return Xỉu for result 3-10', async () => {
    toolRepo.insertUsageLog.mockResolvedValue(undefined);
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    const result = await toolService.processTool(1, 'Zon88', 5, 'R001', PKG_INFO);

    expect(result.result).toBe('#R001 - Xỉu');
    expect(result.turns_left).toBe(6); // 10 - (3+1)
  });

  it('should return Tài for result 11-18', async () => {
    toolRepo.insertUsageLog.mockResolvedValue(undefined);
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    const result = await toolService.processTool(1, 'Zon88', 15, 'R002', PKG_INFO);

    expect(result.result).toBe('#R002 - Tài');
  });

  it('should log usage when demo gateway + result + roundCode', async () => {
    toolRepo.insertUsageLog.mockResolvedValue(undefined);
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    await toolService.processTool(1, 'Zon88', 7, 'R003', PKG_INFO);

    expect(toolRepo.insertUsageLog).toHaveBeenCalledWith(1, 'Zon88', 'Xỉu', 'R003');
  });

  it('should NOT log usage when result or roundCode missing', async () => {
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    await toolService.processTool(1, 'Zon88', null, null, PKG_INFO);

    expect(toolRepo.insertUsageLog).not.toHaveBeenCalled();
  });

  it('should increment turns for paid package', async () => {
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    await toolService.processTool(1, 'Zon88', null, null, PKG_INFO);

    expect(toolRepo.incrementTurnsUsed).toHaveBeenCalledWith(2);
  });

  it('should NOT increment turns when package id is 0 (trial falsy)', async () => {
    const trialPkg = { id: 0, max_turns: 5, turns_used: 2, allowed_gateways: ['Zon88'] };

    await toolService.processTool(1, 'Zon88', null, null, trialPkg);

    expect(toolRepo.incrementTurnsUsed).not.toHaveBeenCalled();
  });

  it('should return result without roundCode prefix when roundCode null', async () => {
    toolRepo.incrementTurnsUsed.mockResolvedValue(undefined);

    const result = await toolService.processTool(1, 'Zon88', null, null, PKG_INFO);

    // No '#roundCode - ' prefix
    expect(result.result).toMatch(/^(Tài|Xỉu)$/);
  });
});
