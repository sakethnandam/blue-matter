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
    return code.slice(0, 100_000).replaceAll('\0', '').trim();
  }

  sanitizeAnnotation(text: string): string {
    if (typeof text !== 'string') return '';
    return text.slice(0, 10_000).replaceAll('\0', '').trim();
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

  /**
   * Sanitize a markdown cell before including it in an AI prompt.
   * Strips HTML comments (differential parser attack prevention) and detects injection.
   */
  sanitizeMarkdownCell(markdown: string): { sanitized: string; injectionDetected: boolean } {
    if (typeof markdown !== 'string') return { sanitized: '', injectionDetected: false };
    // Bound first, then strip null bytes so "<!\0-- -->" cannot evade the comment regex
    const bounded = markdown.slice(0, 10_000).replaceAll('\0', '');
    // Strip complete HTML comments then any dangling unclosed opener (injection hiding)
    const noComments = bounded
      .replaceAll(/<!--[\s\S]*?-->/g, '')
      .replace(/<!--[\s\S]*$/, '');
    const stripped = noComments.trim();
    const injectionDetected = this.detectSuspiciousCode(stripped);
    return { sanitized: stripped, injectionDetected };
  }

  /**
   * Scan AI response text for credential-like patterns and redact them.
   * Defense in depth: the AI should never emit these, but we verify.
   * Uses local pattern objects on each call — no shared RegExp state.
   */
  sanitizeAIResponse(response: string): string {
    if (typeof response !== 'string') return '';
    // /g patterns created fresh each call — no shared lastIndex state
    const patterns: Array<[RegExp, string]> = [
      [/sk-or-v1-[a-zA-Z0-9\-_]{10,}/g, '[REDACTED_API_KEY]'],
      [/sk-ant-[a-zA-Z0-9\-_]{10,}/g, '[REDACTED_API_KEY]'],
      [/sk-[a-zA-Z0-9\-_]{40,}/g, '[REDACTED_API_KEY]'],
      [/Bearer\s+[a-zA-Z0-9\-_.]{20,}/g, 'Bearer [REDACTED]'],
    ];
    let result = response;
    for (const [re, replacement] of patterns) {
      result = result.replace(re, replacement);
    }
    return result;
  }
}
