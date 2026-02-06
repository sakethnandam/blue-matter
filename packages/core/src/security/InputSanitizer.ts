/**
 * Input sanitizer - sanitizes code and user text for safe processing
 */

export class InputSanitizer {
  private static readonly SUSPICIOUS_PATTERNS = [
    /ignore\s+previous\s+instructions/gi,
    /you\s+are\s+now/gi,
    /forget\s+everything/gi,
    /act\s+as\s+/gi,
    /disregard\s+above/gi,
  ];

  sanitizeCode(code: string): string {
    if (typeof code !== 'string') return '';
    return code.slice(0, 100_000).trim();
  }

  sanitizeAnnotation(text: string): string {
    if (typeof text !== 'string') return '';
    return text.slice(0, 10_000).trim();
  }

  /** Returns true if code may contain prompt injection attempts */
  detectSuspiciousCode(code: string): boolean {
    for (const pattern of InputSanitizer.SUSPICIOUS_PATTERNS) {
      if (pattern.test(code)) return true;
    }
    return false;
  }
}
