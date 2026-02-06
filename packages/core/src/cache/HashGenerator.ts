/**
 * Hash generator - content-based and structural hashing for cache keys
 */

import { createHash } from 'node:crypto';

/**
 * Normalize code for hashing: trim, collapse whitespace, remove line comments
 */
function normalizeForHash(code: string): string {
  return code
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Generate SHA-256 hash of code (content-based, normalized)
 */
export function generateCodeHash(code: string): string {
  const normalized = normalizeForHash(code);
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Structural signature: same structure gives same string (for similarity)
 * Replace identifiers with placeholders to match similar code
 */
export function generateStructuralSignature(code: string): string {
  const normalized = normalizeForHash(code);
  const noStrings = normalized.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '""');
  const noNumbers = noStrings.replace(/\b\d+\.?\d*\b/g, '0');
  return noNumbers;
}
