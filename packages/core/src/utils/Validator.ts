/**
 * Input validation utilities
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSafeCodeLength(code: string, maxLength: number): boolean {
  return typeof code === 'string' && code.length > 0 && code.length <= maxLength;
}

export function isValidCodeHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
}
