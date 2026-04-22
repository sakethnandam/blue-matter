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
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\/\/[^\n]*/g, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Generate SHA-256 hash of code (content-based, normalized).
 * Pass `extraContext` (e.g. `cellIndex + '\x00' + dependencySummaryHash`) to
 * produce a notebook-aware cache key without re-normalizing the suffix.
 */
export function generateCodeHash(code: string, extraContext?: string): string {
  const normalized = normalizeForHash(code);
  const input = extraContext ? normalized + '\x00' + extraContext : normalized;
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Structural signature: same structure gives same string (for similarity)
 * Replace identifiers with placeholders to match similar code
 */
export function generateStructuralSignature(code: string): string {
  const normalized = normalizeForHash(code);
  const noStrings = normalized.replaceAll(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '""');
  const noNumbers = noStrings.replaceAll(/\b\d+\.?\d*\b/g, '0');
  return noNumbers;
}
