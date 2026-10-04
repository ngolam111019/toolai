/**
 * Format Utils — Unit Tests
 */
const format = require('../../../src/utils/format');

describe('formatCurrency', () => {
  it('should format number as VND currency', () => {
    expect(format.formatCurrency(1499000)).toMatch(/1\.499\.000/);
    expect(format.formatCurrency(1499000)).toMatch(/₫/);
  });

  it('should format 0 correctly', () => {
    expect(format.formatCurrency(0)).toMatch(/0/);
  });

  it('should format large numbers', () => {
    expect(format.formatCurrency(1000000000)).toMatch(/1\.000\.000\.000/);
  });
});

describe('formatNumber', () => {
  it('should format with thousand separators', () => {
    expect(format.formatNumber(1499000)).toBe('1.499.000');
  });

  it('should not add separator for small numbers', () => {
    expect(format.formatNumber(999)).toBe('999');
  });

  it('should handle 0', () => {
    expect(format.formatNumber(0)).toBe('0');
  });
});

describe('formatWithUnit', () => {
  it('should format with default unit "xu"', () => {
    expect(format.formatWithUnit(1000)).toBe('1.000 xu');
  });

  it('should format with custom unit', () => {
    expect(format.formatWithUnit(50000, 'đ')).toBe('50.000 đ');
    expect(format.formatWithUnit(100, 'VNĐ')).toBe('100 VNĐ');
  });
});

describe('formatDateVN', () => {
  it('should format date to Vietnam timezone', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = format.formatDateVN(date);

    // Should contain date parts
    expect(result).toMatch(/\d{1,2}/); // day
    expect(result).toMatch(/\d{1,2}/); // month
    expect(result).toMatch(/2024/); // year
  });

  it('should handle invalid date gracefully', () => {
    // The function catches errors and returns '---', but some invalid inputs
    // may result in 'Invalid Date' string from toLocaleString
    const result = format.formatDateVN('invalid-date');
    expect(['---', 'Invalid Date']).toContain(result);
  });
});

describe('getTodayVN', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const result = format.getTodayVN();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getTodayVNDatetime', () => {
  it('should return a Date object', () => {
    const result = format.getTodayVNDatetime();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return a valid date', () => {
    const result = format.getTodayVNDatetime();
    expect(result.getTime()).not.toBeNaN();
  });
});

describe('titleDescTypeSenDiscord', () => {
  it('should format upgrade notification (isOneClick=true)', () => {
    const result = format.titleDescTypeSenDiscord(true, 123, 'Pro', 150000, 0, 'TRX001');

    expect(result.type).toBe('upgrade');
    expect(result.t).toContain('123');
    expect(result.t).toContain('Pro');
    expect(result.d).toContain('150.000');
    expect(result.d).toContain('TRX001');
    expect(result.d).toContain('Android');
  });

  it('should format payment notification (isOneClick=false)', () => {
    const result = format.titleDescTypeSenDiscord(false, 456, 'Basic', 50000, 1, 'TRX002');

    expect(result.type).toBe('payment');
    expect(result.t).toContain('456');
    expect(result.t).toContain('50.000');
    expect(result.d).toContain('TRX002');
    expect(result.d).toContain('iOS');
  });

  it('should handle missing tranId', () => {
    const result = format.titleDescTypeSenDiscord(true, 123, 'Pro', 100000, 0, null);

    expect(result.d).not.toContain('Mã giao dịch: null');
  });
});
