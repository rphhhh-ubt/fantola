import { formatDate, isValidEmail } from '../index';

describe('formatDate', () => {
  it('should format date as ISO string', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const result = formatDate(date);
    expect(result).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should handle different dates correctly', () => {
    const date = new Date('2023-12-31T23:59:59.999Z');
    const result = formatDate(date);
    expect(result).toBe('2023-12-31T23:59:59.999Z');
  });
});

describe('isValidEmail', () => {
  it('should validate correct email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.co.uk')).toBe(true);
    expect(isValidEmail('test+tag@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('invalid@example')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('should reject emails with spaces', () => {
    expect(isValidEmail('test @example.com')).toBe(false);
    expect(isValidEmail('test@ example.com')).toBe(false);
  });
});
