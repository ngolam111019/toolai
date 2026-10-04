/**
 * Payment Service — Unit Tests
 *
 * Test VietQR payment creation và Sepay webhook handling
 */
const crypto = require('crypto');

jest.mock('../../../src/repositories/payment-repository');
jest.mock('../../../src/config/db', () => ({
  query: jest.fn(),
  pool: {},
  withTransaction: jest.fn((callback) => callback({})),
}));
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

// Set env vars before requiring service
process.env.MBBANK_ACCOUNT_NO = '0123456789';
process.env.MBBANK_ACCOUNT_NAME = 'Test Account';
process.env.SEPAY_API_KEY = 'test-api-key';
process.env.SEPAY_WEBHOOK_SECRET = 'test-webhook-secret';

const paymentRepo = require('../../../src/repositories/payment-repository');
const paymentService = require('../../../src/services/payment-service');

describe('paymentService.createPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create transaction and return QR data with MB Bank', async () => {
    paymentRepo.createTransaction.mockResolvedValue(undefined);

    const result = await paymentService.createPayment(1, 100000, 2);

    expect(result).toHaveProperty('tranid');
    expect(result).toHaveProperty('expired_at');
    expect(result).toHaveProperty('qr_url');
    expect(result).toHaveProperty('bank');
    expect(result.bank).toBe('MB Bank');
    expect(result.account_number).toBe('0123456789');
    expect(result.account_name).toBe('Test Account');
    expect(result.content).toMatch(/^UID1 [A-F0-9]{6}$/);
    expect(paymentRepo.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('should pass correct params to createTransaction', async () => {
    paymentRepo.createTransaction.mockResolvedValue(undefined);

    await paymentService.createPayment(42, 200000, 3);

    const [userId, amount, tranId, expiredAt, pkgId, transferCode] = paymentRepo.createTransaction.mock.calls[0];
    expect(userId).toBe(42);
    expect(amount).toBe(200000);
    expect(typeof tranId).toBe('string');
    expect(tranId.length).toBeGreaterThan(10); // UUID
    expect(expiredAt).toBeInstanceOf(Date);
    expect(pkgId).toBe(3);
    expect(transferCode).toMatch(/^[A-F0-9]{6}$/);
  });

  it('should generate VietQR URL with correct format', async () => {
    paymentRepo.createTransaction.mockResolvedValue(undefined);

    const result = await paymentService.createPayment(1, 50000, null);

    expect(result.qr_url).toContain('https://img.vietqr.io/image/MB-');
    expect(result.qr_url).toContain('0123456789');
    expect(result.qr_url).toContain('amount=50000');
    expect(result.qr_url).toContain('addInfo=');
  });
});

describe('paymentService.parseTransferContent', () => {
  it('should parse valid content', () => {
    const result = paymentService.parseTransferContent('UID123 ABC456');
    expect(result).toEqual({ userId: 123, transferCode: 'ABC456' });
  });

  it('should handle lowercase content', () => {
    const result = paymentService.parseTransferContent('uid42 def789');
    expect(result).toEqual({ userId: 42, transferCode: 'DEF789' });
  });

  it('should return null for invalid content', () => {
    expect(paymentService.parseTransferContent('random text')).toBeNull();
    expect(paymentService.parseTransferContent('')).toBeNull();
    expect(paymentService.parseTransferContent(null)).toBeNull();
  });

  it('should reject non-hex transfer codes', () => {
    expect(paymentService.parseTransferContent('UID1 GHIJKL')).toBeNull();
  });
});

describe('paymentService.verifySepayApiKey', () => {
  it('should return true for valid API key', () => {
    expect(paymentService.verifySepayApiKey('test-api-key')).toBe(true);
  });

  it('should return false for invalid API key', () => {
    expect(paymentService.verifySepayApiKey('wrong-key')).toBe(false);
  });
});

describe('paymentService.verifySepayHmac', () => {
  const secret = 'test-webhook-secret';

  function generateValidSignature(timestamp, body) {
    const payload = `${timestamp}.${body}`;
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  it('should return true for valid HMAC signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ transferAmount: 50000 });
    const signature = generateValidSignature(timestamp, body);

    expect(paymentService.verifySepayHmac(signature, timestamp, body)).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ transferAmount: 50000 });

    expect(paymentService.verifySepayHmac('sha256=invalid', timestamp, body)).toBe(false);
  });

  it('should return false for expired timestamp', () => {
    const timestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const body = JSON.stringify({ transferAmount: 50000 });
    const signature = generateValidSignature(timestamp, body);

    expect(paymentService.verifySepayHmac(signature, timestamp, body)).toBe(false);
  });

  it('should return false for missing signature or timestamp', () => {
    expect(paymentService.verifySepayHmac(null, '123', 'body')).toBe(false);
    expect(paymentService.verifySepayHmac('sig', null, 'body')).toBe(false);
  });
});

describe('paymentService.handleSepayWebhook', () => {
  beforeEach(() => jest.clearAllMocks());

  const validWebhookData = {
    transferAmount: 100000,
    content: 'UID10 ABC123',
    transferType: 'in',
  };

  it('should ignore non-incoming transfers', async () => {
    await paymentService.handleSepayWebhook({ ...validWebhookData, transferType: 'out' });
    expect(paymentRepo.findPendingTransactionByCode).not.toHaveBeenCalled();
  });

  it('should ignore unparseable content', async () => {
    await paymentService.handleSepayWebhook({ ...validWebhookData, content: 'random' });
    expect(paymentRepo.findPendingTransactionByCode).not.toHaveBeenCalled();
  });

  it('should ignore when no pending transaction found', async () => {
    paymentRepo.findPendingTransactionByCode.mockResolvedValue(null);

    await paymentService.handleSepayWebhook(validWebhookData);

    expect(paymentRepo.findPendingTransactionByCode).toHaveBeenCalledWith('ABC123');
    expect(paymentRepo.creditUserBalance).not.toHaveBeenCalled();
  });

  it('should ignore when userId does not match', async () => {
    paymentRepo.findPendingTransactionByCode.mockResolvedValue({
      id: 1,
      user_id: 99,
      ref_code: 'txn-123',
    });

    await paymentService.handleSepayWebhook(validWebhookData);

    expect(paymentRepo.creditUserBalance).not.toHaveBeenCalled();
  });

  it('should credit balance and mark success on valid payment', async () => {
    paymentRepo.findPendingTransactionByCode.mockResolvedValue({
      id: 1,
      user_id: 10,
      ref_code: 'txn-123',
      amount: 100000,
      package_id: null,
    });
    paymentRepo.getUserForNotification.mockResolvedValue({ platform: 0 });
    paymentRepo.creditUserBalance.mockResolvedValue(undefined);
    paymentRepo.markTransactionSuccess.mockResolvedValue(undefined);

    await paymentService.handleSepayWebhook(validWebhookData);

    expect(paymentRepo.creditUserBalance).toHaveBeenCalledWith(10, 100000, {});
    expect(paymentRepo.markTransactionSuccess).toHaveBeenCalledWith(1, 100000, {});
  });

  it('should add bonus for payments >= 2 million', async () => {
    const highValuePayment = {
      transferAmount: 2000000,
      content: 'UID10 ABC123',
      transferType: 'in',
    };

    paymentRepo.findPendingTransactionByCode.mockResolvedValue({
      id: 1,
      user_id: 10,
      ref_code: 'txn-123',
      amount: 2000000,
      package_id: null,
    });
    paymentRepo.getUserForNotification.mockResolvedValue({ platform: 0 });
    paymentRepo.creditUserBalance.mockResolvedValue(undefined);
    paymentRepo.markTransactionSuccess.mockResolvedValue(undefined);
    paymentRepo.insertBonusTransaction.mockResolvedValue(undefined);

    await paymentService.handleSepayWebhook(highValuePayment);

    expect(paymentRepo.creditUserBalance).toHaveBeenCalledWith(10, 2000000, {});
    expect(paymentRepo.insertBonusTransaction).toHaveBeenCalledWith(10, 500000, 'txn-123', {});
    expect(paymentRepo.creditUserBalance).toHaveBeenCalledWith(10, 500000, {});
  });

  it('should upgrade package when package_id is set', async () => {
    paymentRepo.findPendingTransactionByCode.mockResolvedValue({
      id: 1,
      user_id: 10,
      ref_code: 'txn-123',
      amount: 100000,
      package_id: 2,
    });
    paymentRepo.getUserForNotification.mockResolvedValue({ platform: 0 });
    paymentRepo.creditUserBalance.mockResolvedValue(undefined);
    paymentRepo.markTransactionSuccess.mockResolvedValue(undefined);
    paymentRepo.findPackageById.mockResolvedValue({
      id: 2,
      name: 'Premium',
      price: 99000,
      is_lifetime: false,
      duration_days: 30,
    });
    paymentRepo.getUserBalance.mockResolvedValue(150000);
    paymentRepo.debitUserBalance.mockResolvedValue(undefined);
    paymentRepo.insertPurchaseTransaction.mockResolvedValue(undefined);
    paymentRepo.deleteUserPackages.mockResolvedValue(undefined);
    paymentRepo.createUserPackage.mockResolvedValue(undefined);
    paymentRepo.insertUserEventLog.mockResolvedValue(undefined);

    await paymentService.handleSepayWebhook(validWebhookData);

    expect(paymentRepo.findPackageById).toHaveBeenCalledWith(2);
    expect(paymentRepo.debitUserBalance).toHaveBeenCalledWith(10, 99000, {});
    expect(paymentRepo.deleteUserPackages).toHaveBeenCalledWith(10, {});
    expect(paymentRepo.createUserPackage).toHaveBeenCalled();
  });
});
