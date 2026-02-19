/**
 * Unit tests for Validator
 */

import {
  isNonEmptyString,
  isSafeCodeLength,
  isValidCodeHash,
} from '../../../src/utils/Validator';

describe('Validator', () => {
  describe('isNonEmptyString', () => {
    it('returns true for non-empty string', () => {
      expect(isNonEmptyString('hello')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });

    it('returns false for whitespace only', () => {
      expect(isNonEmptyString('   ')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isSafeCodeLength', () => {
    it('returns true when within limit', () => {
      expect(isSafeCodeLength('code', 100)).toBe(true);
    });

    it('returns false when over limit', () => {
      expect(isSafeCodeLength('x'.repeat(101), 100)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSafeCodeLength('', 100)).toBe(false);
    });
  });

  describe('isValidCodeHash', () => {
    it('returns true for valid 64-char hex', () => {
      expect(isValidCodeHash('a'.repeat(64))).toBe(true);
      expect(isValidCodeHash('f'.repeat(64))).toBe(true);
    });

    it('returns false for wrong length', () => {
      expect(isValidCodeHash('a'.repeat(63))).toBe(false);
      expect(isValidCodeHash('a'.repeat(65))).toBe(false);
    });

    it('returns false for non-hex', () => {
      expect(isValidCodeHash('g'.repeat(64))).toBe(false);
      expect(isValidCodeHash('z'.repeat(64))).toBe(false);
    });

    it('returns false for non-string', () => {
      expect(isValidCodeHash(null)).toBe(false);
      expect(isValidCodeHash(123)).toBe(false);
    });
  });
});
