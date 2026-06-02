const AppError = require('../../../src/utils/app-error');
const { errorHandler, notFoundHandler } = require('../../../src/middleware/error-handler');

// Mock discord-notify — không gọi thật
jest.mock('../../../src/utils/discord-notify', () => ({
  sendDiscord: jest.fn().mockResolvedValue(undefined),
}));

describe('errorHandler middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { method: 'GET', url: '/test' };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    // Suppress console.error in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 500 with generic message for non-operational errors', () => {
    const error = new Error('database crashed');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      },
    });
  });

  it('should return specific message for operational AppError', () => {
    const error = new AppError('User not found', 404, 'USER_NOT_FOUND');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
    });
  });

  it('should return 403 for forbidden AppError', () => {
    const error = new AppError('Thiết bị không hợp lệ', 403, 'DEVICE_MISMATCH');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'DEVICE_MISMATCH',
        message: 'Thiết bị không hợp lệ',
      },
    });
  });

  it('should send Discord alert for 5xx errors', () => {
    const { sendDiscord } = require('../../../src/utils/discord-notify');
    const error = new Error('crash');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(sendDiscord).toHaveBeenCalled();
  });

  it('should NOT send Discord for 4xx errors', () => {
    const { sendDiscord } = require('../../../src/utils/discord-notify');
    sendDiscord.mockClear();
    const error = new AppError('bad request', 400, 'BAD');

    errorHandler(error, mockReq, mockRes, mockNext);

    expect(sendDiscord).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler middleware', () => {
  it('should call next with a 404 AppError', () => {
    const mockReq = { method: 'GET', url: '/not-existing' };
    const mockRes = {};
    const mockNext = jest.fn();

    notFoundHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('ROUTE_NOT_FOUND');
  });
});
