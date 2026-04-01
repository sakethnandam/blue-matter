/**
 * Input sanitizer - sanitizes code and user text for safe processing
 */

export class InputSanitizer {
  // No /g flag: stateful lastIndex on shared RegExp instances causes false negatives on repeated calls
  private static readonly SUSPICIOUS_PATTERNS = [
    /ignore\s+previous\s+instructions/i,
    /you\s+are\s+now/i,
    /forget\s+everything/i,
    /act\s+as\s+/i,
    /disregard\s+above/i,
    /system\s*:/i,
    /\n\s*(human|assistant|user)\s*:/i,
    /<\s*instructions?\s*>/i,
    /jailbreak/i,
  ];

  sanitizeCode(code: string): string {
    if (typeof code !== 'string') return '';
    // Strip null bytes before returning (can be used to confuse downstream parsers)
    return code.slice(0, 100_000).replace(/\0/g, '').trim();
  }

  sanitizeAnnotation(text: string): string {
    if (typeof text !== 'string') return '';
    return text.slice(0, 10_000).replace(/\0/g, '').trim();
  }

  /** Returns true if code may contain prompt injection attempts */
  detectSuspiciousCode(code: string): boolean {
    if (typeof code !== 'string') return false;
    // Run detection only on the same truncated slice used for sanitization
    const truncated = code.slice(0, 100_000);
    for (const pattern of InputSanitizer.SUSPICIOUS_PATTERNS) {
      if (pattern.test(truncated)) return true;
    }
    return false;
  }
}
