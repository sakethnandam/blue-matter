/**
 * Secure logger - redacts sensitive data from logs
 */

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{40,}/g,
  /sk-or-v1-[a-zA-Z0-9-_]{40,}/g,
  /sk-ant-[a-zA-Z0-9-_]{40,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
  /password["\s:=]+[^\s"]+/gi,
];

const SENSITIVE_KEYS = ['apiKey', 'password', 'token', 'secret', 'authorization'];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function sanitize(text: string): string {
  let out = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeObject(value);
      }
    }
    return result;
  }
  return obj;
}

export function createLogger(transport?: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void): Logger {
  const log = (level: LogLevel) => (message: string, meta?: Record<string, unknown>) => {
    const sanitizedMessage = sanitize(message);
    const sanitizedMeta = meta ? (sanitizeObject(meta) as Record<string, unknown>) : undefined;
    if (transport) {
      transport(level, sanitizedMessage, sanitizedMeta);
    } else {
      const prefix = `[Untitled] [${level.toUpperCase()}]`;
      if (sanitizedMeta) {
        console[level === 'debug' ? 'log' : level](prefix, sanitizedMessage, sanitizedMeta);
      } else {
        console[level === 'debug' ? 'log' : level](prefix, sanitizedMessage);
      }
    }
  };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}
