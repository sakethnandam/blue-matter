/**
 * Unit tests for Logger
 */

import { createLogger } from '../../../src/utils/Logger';

describe('Logger', () => {
  describe('createLogger with transport', () => {
    it('calls transport with sanitized message', () => {
      const messages: string[] = [];
      const logger = createLogger((_level, msg) => messages.push(msg));
      logger.info('hello');
      expect(messages).toContain('hello');
    });

    it('redacts API key from message', () => {
      const messages: string[] = [];
      const logger = createLogger((_level, msg) => messages.push(msg));
      const key = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef';
      logger.info(`key: ${key}`);
      expect(messages[0]).not.toContain(key);
      expect(messages[0]).toContain('[REDACTED]');
    });

    it('redacts apiKey from meta', () => {
      const metas: Record<string, unknown>[] = [];
      const logger = createLogger((_level, _msg, meta) => meta && metas.push(meta));
      logger.info('msg', { apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcdef' });
      expect(metas[0]).toEqual({ apiKey: '[REDACTED]' });
    });

    it('all log levels work', () => {
      const logs: { level: string; msg: string }[] = [];
      const logger = createLogger((level, msg) => logs.push({ level, msg }));
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(logs.map((l) => l.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });
});
