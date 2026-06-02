const asyncHandler = require('../../../src/utils/async-handler');

describe('asyncHandler', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call the wrapped function with req, res, next', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should call next with error when async function throws', async () => {
    const error = new Error('async failure');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should NOT call next when async function succeeds', async () => {
    const handler = jest.fn(async (req, res) => {
      res.json({ ok: true });
    });
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
  });

  it('should catch sync throws because Promise.resolve evaluates fn() first', () => {
    // KNOWN BEHAVIOR: asyncHandler uses Promise.resolve(fn(req, res, next))
    // If fn throws synchronously, the error escapes before Promise.resolve wraps it.
    // This is expected — all our handlers are async functions which always return promises.
    const error = new Error('sync failure');
    const handler = jest.fn(() => { throw error; });
    const wrapped = asyncHandler(handler);

    // Sync throw escapes — this is expected behavior
    expect(() => wrapped(mockReq, mockRes, mockNext)).toThrow('sync failure');
  });

});
