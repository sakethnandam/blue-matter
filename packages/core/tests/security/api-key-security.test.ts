/**
 * Security tests: API key security (PRD 6.5.1)
 * Verify secrets are never logged
 */

import { createLogger } from '../../src/utils/Logger';

describe('Security: API Key Security', () => {
  describe('Logger never logs API keys', () => {
    it('redacts Open Router API keys (sk-or-v1-...) from message', () => {
      const logs: string[] = [];
      const logger = createLogger((_level, message) => logs.push(message));
      const apiKey = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef';

      logger.info(`Using API key: ${apiKey}`);

      expect(logs.join(' ')).not.toContain(apiKey);
      expect(logs.join(' ')).toContain('[REDACTED]');
    });

    it('redacts generic sk- API keys from message', () => {
      const logs: string[] = [];
      const logger = createLogger((_level, message) => logs.push(message));
      const apiKey = 'sk-abcdefghijklmnopqrstuvwxyz1234567890abcd';

      logger.info(`Connecting with key: ${apiKey}`);

      expect(logs.join(' ')).not.toContain(apiKey);
      expect(logs.join(' ')).toContain('[REDACTED]');
    });

    it('redacts Bearer tokens from message', () => {
      const logs: string[] = [];
      const logger = createLogger((_level, message) => logs.push(message));
      const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      logger.info(`Auth: ${token}`);

      expect(logs.join(' ')).not.toContain(token);
      expect(logs.join(' ')).toContain('[REDACTED]');
    });

    it('redacts apiKey from metadata object', () => {
      const captured: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && captured.push(meta));

      logger.info('Config', { apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef', userId: 'user-1' });

      expect(captured[0]).toEqual({ apiKey: '[REDACTED]', userId: 'user-1' });
    });

    it('redacts password from metadata object', () => {
      const captured: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && captured.push(meta));

      logger.info('Auth', { password: 'super-secret', user: 'admin' });

      expect(captured[0]).toEqual({ password: '[REDACTED]', user: 'admin' });
    });

    it('redacts token from metadata object', () => {
      const captured: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && captured.push(meta));

      logger.info('Request', { token: 'jwt-xyz', action: 'fetch' });

      expect(captured[0]).toEqual({ token: '[REDACTED]', action: 'fetch' });
    });

    it('redacts nested sensitive keys', () => {
      const captured: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && captured.push(meta));

      logger.info('Config', {
        config: {
          auth: { apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef', realm: 'public' },
        },
      });

      expect(JSON.stringify(captured[0])).not.toContain('sk-or-v1-');
      expect(JSON.stringify(captured[0])).toContain('[REDACTED]');
    });

    it('redacts sensitive data in array values', () => {
      const captured: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && captured.push(meta));

      logger.info('Keys', { keys: ['sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef', 'normal'] });

      const keys = captured[0]?.keys as string[];
      expect(keys[0]).toBe('[REDACTED]');
      expect(keys[1]).toBe('normal');
    });

    it('all log levels sanitize output', () => {
      const logs: string[] = [];
      const logger = createLogger((_level, message) => logs.push(message));
      const secret = 'sk-abcdefghijklmnopqrstuvwxyz1234567890abcdef';

      logger.debug(`Debug: ${secret}`);
      logger.info(`Info: ${secret}`);
      logger.warn(`Warn: ${secret}`);
      logger.error(`Error: ${secret}`);

      for (const log of logs) {
        expect(log).not.toContain(secret);
        expect(log).toContain('[REDACTED]');
      }
    });
  });
});
