/**
 * Payment Service — Unit Tests
 *
 * Chỉ test createPayment và verify logic.
 * handlePaymentCallback phức tạp → test các path chính.
 */
const crypto = require('crypto');

jest.mock('../../../src/repositories/payment-repository');
jest.mock('axios');
jest.mock('../../../src/utils/discord-notify', () => ({
  sendDiscord: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/noti', () => ({
  pushNoti: jest.fn(),
}));
jest.mock('../../../src/services/socket-service', () => ({
  emitToRoom: jest.fn().mockReturnValue(true),
}));
jest.mock('../../../src/utils/format', () => ({
  formatWithUnit: jest.fn((amount, unit) => `${amount} ${unit}`),
  titleDescTypeSenDiscord: jest.fn(() => ({ t: 'title', d: 'desc', type: 'payment' })),
}));

process.env.IS_PAYMENT_API_DEMO = '1';
process.env.GB_USERNAME = 'testuser';
process.env.GB_PASSWORD = 'testpass';

const paymentRepo = require('../../../src/repositories/payment-repository');
const paymentService = require('../../../src/services/payment-service');
const AppError = require('../../../src/utils/app-error');

describe('paymentService.createPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create transaction and return QR data in demo mode', async () => {
    paymentRepo.createTransaction.mockResolvedValue(undefined);

    const result = await paymentService.createPayment(1, 100000, 2);

    expect(result).toHaveProperty('tranid');
    expect(result).toHaveProperty('expired_at');
    expect(result).toHaveProperty('qr_url');
    expect(result).toHaveProperty('bank');
    expect(result.bank).toBe('Vietcombank');
    expect(paymentRepo.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('should pass correct params to createTransaction', async () => {
    paymentRepo.createTransaction.mockResolvedValue(undefined);

    await paymentService.createPayment(42, 200000, 3);

    const [userId, amount, tranId, expiredAt, pkgId] = paymentRepo.createTransaction.mock.calls[0];
    expect(userId).toBe(42);
    expect(amount).toBe(200000);
    expect(typeof tranId).toBe('string');
    expect(tranId.length).toBeGreaterThan(10); // UUID
    expect(expiredAt).toBeInstanceOf(Date);
    expect(pkgId).toBe(3);
  });
});

describe('paymentService.handlePaymentCallback', () => {
  beforeEach(() => jest.clearAllMocks());

  function makeValidCallbackParams(overrides = {}) {
    const base = {
      username: 'testuser',
      password: 'testpass',
      amount: '100000',
      tran_id: 'txn-123',
      errorcode: '9',
      messages: 'Success',
    };
    const merged = { ...base, ...overrides };
    const raw = merged.username + merged.password + merged.amount + merged.tran_id + merged.errorcode + merged.messages;
    merged.signature = crypto.createHash('sha256').update(raw).digest('hex');
    return merged;
  }

  it('should throw INVALID_SIGNATURE for bad signature', async () => {
    const params = makeValidCallbackParams();
    params.signature = 'bad-sig';

    await expect(paymentService.handlePaymentCallback(params))
      .rejects.toMatchObject({ code: 'INVALID_SIGNATURE', statusCode: 403 });
  });

  it('should throw INVALID_CREDENTIALS for wrong username', async () => {
    const params = makeValidCallbackParams({ username: 'hacker' });
    // Recalculate sig with hacker username
    const raw = 'hacker' + params.password + params.amount + params.tran_id + params.errorcode + params.messages;
    params.signature = crypto.createHash('sha256').update(raw).digest('hex');

    await expect(paymentService.handlePaymentCallback(params))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 403 });
  });

  it('should throw TRANSACTION_NOT_FOUND when no pending tx', async () => {
    const params = makeValidCallbackParams();
    paymentRepo.findPendingTransaction.mockResolvedValue(null);

    await expect(paymentService.handlePaymentCallback(params))
      .rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND', statusCode: 404 });
  });

  it('should mark failed and throw when errorcode != 9', async () => {
    const params = makeValidCallbackParams({ errorcode: '0', messages: 'Cancelled' });
    // Recalculate sig
    const raw = params.username + params.password + params.amount + params.tran_id + '0' + 'Cancelled';
    params.signature = crypto.createHash('sha256').update(raw).digest('hex');

    paymentRepo.findPendingTransaction.mockResolvedValue({ id: 1, user_id: 10, ref_code: 'txn-123' });
    paymentRepo.getUserForNotification.mockResolvedValue({ platform: 0 });
    paymentRepo.markTransactionFailed.mockResolvedValue(undefined);

    await expect(paymentService.handlePaymentCallback(params))
      .rejects.toMatchObject({ code: 'PAYMENT_FAILED', statusCode: 400 });

    expect(paymentRepo.markTransactionFailed).toHaveBeenCalledWith(1);
  });

  it('should credit balance and mark success on valid payment', async () => {
    const params = makeValidCallbackParams();

    paymentRepo.findPendingTransaction.mockResolvedValue({
      id: 1, user_id: 10, ref_code: 'txn-123', package_id: null,
    });
    paymentRepo.getUserForNotification.mockResolvedValue({ platform: 0 });
    paymentRepo.creditUserBalance.mockResolvedValue(undefined);
    paymentRepo.markTransactionSuccess.mockResolvedValue(undefined);

    await paymentService.handlePaymentCallback(params);

    expect(paymentRepo.creditUserBalance).toHaveBeenCalledWith(10, '100000');
    expect(paymentRepo.markTransactionSuccess).toHaveBeenCalledWith(1, '100000');
  });
});
