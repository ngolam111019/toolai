/**
 * Common Utils — Unit Tests
 */
const { isValidEmail } = require('../../../src/utils/common');

describe('isValidEmail', () => {
  describe('valid emails', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co',
      'user+tag@example.org',
      'a@b.co',
      'user123@test-domain.com',
      'USER@EXAMPLE.COM',
    ];

    test.each(validEmails)('should return true for "%s"', (email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  describe('invalid emails', () => {
    const invalidEmails = [
      '',
      'invalid',
      'no-at-sign.com',
      '@no-local.com',
      'no-domain@',
      'spaces in@email.com',
      'double@@at.com',
      null,
      undefined,
    ];

    test.each(invalidEmails)('should return false for "%s"', (email) => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
});
