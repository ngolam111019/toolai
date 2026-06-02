/**
 * Auth Service — Unit Tests
 *
 * Mock tất cả dependencies: auth.repository, mailer, noti, bcrypt, jwt
 * Chỉ test business logic thuần trong service.
 */

// MUST set before any require — auth.service.js captures JWT_SECRET at module load time
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ─── Mock all dependencies ──────────────────────────────────────────────────
jest.mock('../../../auth/auth.repository');
jest.mock('../../../utils/mailer', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailDangKyThanhCong: jest.fn().mockResolvedValue(undefined),
  sendEmailFogotPassword: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../utils/noti', () => ({
  pushNoti: jest.fn(),
}));
jest.mock('../../../utils/discordNotify', () => ({
  sendDiscord: jest.fn().mockResolvedValue(undefined),
}));

const authRepo = require('../../../auth/auth.repository');
const authService = require('../../../auth/auth.service');
const AppError = require('../../../src/utils/app-error');

// ─── Test Data ──────────────────────────────────────────────────────────────
const MOCK_USER = {
  id: 1,
  email: 'test@example.com',
  password_hash: '$2b$10$abcdefghijklmnopqrstuuDummyHashForTesting',
  device_id: 'device-123',
  fcm_token: null,
  web_push_subscription: null,
};

const MOCK_USER_WITH_SUB = {
  ...MOCK_USER,
  fcm_token: 'fcm-token-123',
};

// ─── login() ────────────────────────────────────────────────────────────────
describe('authService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw INVALID_EMAIL for invalid email', async () => {
    await expect(authService.login('not-email', 'pass', 'dev1'))
      .rejects.toThrow(AppError);

    await expect(authService.login('not-email', 'pass', 'dev1'))
      .rejects.toMatchObject({ code: 'INVALID_EMAIL', statusCode: 400 });
  });

  it('should throw USER_NOT_FOUND when email not in DB', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);

    await expect(authService.login('nobody@test.com', 'pass', 'dev1'))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });

  it('should throw INVALID_CREDENTIALS when password wrong', async () => {
    authRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.login('test@example.com', 'wrongpass', 'device-123'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
  });

  it('should throw DEVICE_MISMATCH when device_id differs', async () => {
    authRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    await expect(authService.login('test@example.com', 'pass', 'different-device'))
      .rejects.toMatchObject({ code: 'DEVICE_MISMATCH', statusCode: 403 });
  });

  it('should return token and data on successful login', async () => {
    authRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    authRepo.findUserPackage.mockResolvedValue(null);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await authService.login('test@example.com', 'pass', 'device-123');

    expect(result).toHaveProperty('token');
    expect(result.email).toBe('test@example.com');
    expect(result.deviceId).toBe('device-123');
    expect(result.isSub).toBe(false);
    expect(result.usedTrial).toBe(0);

    // Verify token is valid JWT
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(1);
  });

  it('should set isSub=true when user has fcm_token', async () => {
    authRepo.findUserByEmail.mockResolvedValue(MOCK_USER_WITH_SUB);
    authRepo.findUserPackage.mockResolvedValue(null);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await authService.login('test@example.com', 'pass', 'device-123');

    expect(result.isSub).toBe(true);
  });

  it('should bind device and send noti when user has no device_id', async () => {
    const userNoDevice = { ...MOCK_USER, device_id: null };
    authRepo.findUserByEmail.mockResolvedValue(userNoDevice);
    authRepo.findUserPackage.mockResolvedValue(null);
    authRepo.updateDeviceId.mockResolvedValue(undefined);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    const { pushNoti } = require('../../../utils/noti');

    await authService.login('test@example.com', 'pass', 'new-device');

    expect(authRepo.updateDeviceId).toHaveBeenCalledWith(1, 'new-device');
    expect(pushNoti).toHaveBeenCalled();
  });
});

// ─── requestRegistrationOtp() ───────────────────────────────────────────────
describe('authService.requestRegistrationOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_EMAIL when email is empty', async () => {
    await expect(authService.requestRegistrationOtp(''))
      .rejects.toMatchObject({ code: 'MISSING_EMAIL' });
    await expect(authService.requestRegistrationOtp(null))
      .rejects.toMatchObject({ code: 'MISSING_EMAIL' });
  });

  it('should throw INVALID_EMAIL for bad format', async () => {
    await expect(authService.requestRegistrationOtp('notanemail'))
      .rejects.toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('should throw EMAIL_ALREADY_EXISTS when user exists', async () => {
    authRepo.findPendingUser.mockResolvedValue({ id: 1 });

    await expect(authService.requestRegistrationOtp('exists@test.com'))
      .rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('should upsert OTP and send email for new user', async () => {
    authRepo.findPendingUser.mockResolvedValue(null);
    authRepo.upsertRegistrationOtp.mockResolvedValue(undefined);

    await authService.requestRegistrationOtp('new@test.com');

    expect(authRepo.upsertRegistrationOtp).toHaveBeenCalled();
    // Verify OTP params: email, 6-digit otp, expiresAt, now
    const [email, otp] = authRepo.upsertRegistrationOtp.mock.calls[0];
    expect(email).toBe('new@test.com');
    expect(otp).toMatch(/^\d{6}$/); // 6 digits
  });
});

// ─── verifyRegistrationOtp() ────────────────────────────────────────────────
describe('authService.verifyRegistrationOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_FIELDS when email or otp missing', async () => {
    await expect(authService.verifyRegistrationOtp('', '123456'))
      .rejects.toMatchObject({ code: 'MISSING_FIELDS' });
    await expect(authService.verifyRegistrationOtp('a@b.com', ''))
      .rejects.toMatchObject({ code: 'MISSING_FIELDS' });
  });

  it('should throw INVALID_OTP when no valid record found', async () => {
    authRepo.findValidRegistrationOtp.mockResolvedValue(null);

    await expect(authService.verifyRegistrationOtp('a@b.com', '999999'))
      .rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('should mark OTP verified on success', async () => {
    authRepo.findValidRegistrationOtp.mockResolvedValue({ email: 'a@b.com', otp: '123456' });
    authRepo.markRegistrationOtpVerified.mockResolvedValue(undefined);

    await authService.verifyRegistrationOtp('a@b.com', '123456');

    expect(authRepo.markRegistrationOtpVerified).toHaveBeenCalledWith('a@b.com');
  });
});

// ─── confirmRegistration() ──────────────────────────────────────────────────
describe('authService.confirmRegistration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw EMAIL_ALREADY_EXISTS when email taken', async () => {
    authRepo.findUserByEmail.mockResolvedValue({ id: 1 });

    await expect(authService.confirmRegistration('taken@test.com', 'pass', 'dev'))
      .rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('should create user with trial and return token', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);
    authRepo.createUser.mockResolvedValue(42);
    authRepo.createTrialPackage.mockResolvedValue(undefined);
    authRepo.insertUserEventLog.mockResolvedValue(undefined);
    authRepo.deleteRegistrationOtp.mockResolvedValue(undefined);

    const result = await authService.confirmRegistration('new@test.com', 'pass123', 'dev-1');

    expect(result.token).toBeDefined();
    expect(result.email).toBe('new@test.com');
    expect(result.isSub).toBe(false);
    expect(result.usedTrial).toBe(0);

    // Verify user creation flow
    expect(authRepo.createUser).toHaveBeenCalled();
    expect(authRepo.createTrialPackage).toHaveBeenCalledWith(42);
    expect(authRepo.insertUserEventLog).toHaveBeenCalledWith(42, 'ON_SIGNUP');
    expect(authRepo.deleteRegistrationOtp).toHaveBeenCalledWith('new@test.com');
  });
});

// ─── verifyPasswordResetOtp() ───────────────────────────────────────────────
describe('authService.verifyPasswordResetOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_FIELDS when missing params', async () => {
    await expect(authService.verifyPasswordResetOtp('', '123'))
      .rejects.toMatchObject({ code: 'MISSING_FIELDS' });
  });

  it('should throw OTP_NOT_FOUND when no record', async () => {
    authRepo.findResetOtp.mockResolvedValue(null);

    await expect(authService.verifyPasswordResetOtp('a@b.com', '123456'))
      .rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
  });

  it('should throw INVALID_OTP when OTP does not match', async () => {
    authRepo.findResetOtp.mockResolvedValue({ otp: '999999', created_at: new Date() });

    await expect(authService.verifyPasswordResetOtp('a@b.com', '111111'))
      .rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  it('should throw OTP_EXPIRED when OTP older than 5 minutes', async () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    authRepo.findResetOtp.mockResolvedValue({ otp: '123456', created_at: tenMinAgo });

    await expect(authService.verifyPasswordResetOtp('a@b.com', '123456'))
      .rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('should succeed when OTP valid and within 5 minutes', async () => {
    const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000);
    authRepo.findResetOtp.mockResolvedValue({ otp: '123456', created_at: oneMinAgo });

    // Should NOT throw
    await expect(authService.verifyPasswordResetOtp('a@b.com', '123456'))
      .resolves.toBeUndefined();
  });
});

// ─── changePassword() ───────────────────────────────────────────────────────
describe('authService.changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_FIELDS when params empty', async () => {
    await expect(authService.changePassword(1, '', 'new'))
      .rejects.toMatchObject({ code: 'MISSING_FIELDS' });
    await expect(authService.changePassword(1, 'old', ''))
      .rejects.toMatchObject({ code: 'MISSING_FIELDS' });
  });

  it('should throw WRONG_PASSWORD when current password wrong', async () => {
    authRepo.findUserById.mockResolvedValue(MOCK_USER);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.changePassword(1, 'wrongold', 'newpass'))
      .rejects.toMatchObject({ code: 'WRONG_PASSWORD', statusCode: 401 });
  });

  it('should update password when current password correct', async () => {
    authRepo.findUserById.mockResolvedValue(MOCK_USER);
    authRepo.updatePassword.mockResolvedValue(undefined);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash-123');

    await authService.changePassword(1, 'correctold', 'newpass');

    expect(authRepo.updatePassword).toHaveBeenCalledWith('test@example.com', 'new-hash-123');
  });
});

// ─── checkToken() ───────────────────────────────────────────────────────────
describe('authService.checkToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should throw MISSING_TOKEN when token empty', async () => {
    await expect(authService.checkToken(null, 'dev'))
      .rejects.toMatchObject({ code: 'MISSING_TOKEN' });
  });

  it('should throw MISSING_DEVICE_ID when device empty', async () => {
    await expect(authService.checkToken('some-token', null))
      .rejects.toMatchObject({ code: 'MISSING_DEVICE_ID' });
  });

  it('should throw INVALID_TOKEN for expired/invalid JWT', async () => {
    await expect(authService.checkToken('invalid-jwt', 'dev'))
      .rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('should throw USER_NOT_FOUND when user deleted', async () => {
    const token = jwt.sign({ id: 999 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    authRepo.findUserById.mockResolvedValue(null);

    await expect(authService.checkToken(token, 'dev'))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('should throw DEVICE_MISMATCH when device differs', async () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    authRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(authService.checkToken(token, 'wrong-device'))
      .rejects.toMatchObject({ code: 'DEVICE_MISMATCH' });
  });

  it('should return email and deviceId on success', async () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    authRepo.findUserById.mockResolvedValue(MOCK_USER);

    const result = await authService.checkToken(token, 'device-123');

    expect(result.email).toBe('test@example.com');
    expect(result.deviceId).toBe('device-123');
  });
});
