const AppError = require('../../../src/utils/app-error');

describe('AppError', () => {
  it('should create error with default values', () => {
    const error = new AppError('something broke');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('something broke');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should create error with custom statusCode and code', () => {
    const error = new AppError('not found', 404, 'USER_NOT_FOUND');

    expect(error.message).toBe('not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.isOperational).toBe(true);
  });

  it('should have a stack trace', () => {
    const error = new AppError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('should be catchable as Error', () => {
    expect(() => { throw new AppError('fail', 400, 'BAD'); })
      .toThrow('fail');
  });
});
