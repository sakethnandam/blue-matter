/**
 * Security tests: Rate limiting and size limits (PRD 6.5.1)
 * maxCodeBlockSize enforcement, rate limit config validation
 */

import * as path from 'node:path';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'This code declares a constant variable x with value 1.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 15 },
    }),
  });
});
import * as os from 'node:os';
import * as fs from 'node:fs';
import { UntitledCore } from '../../src/core/UntitledCore';
import { createTestConfig } from '../helpers/test-helpers';

describe('Security: Rate Limiting', () => {
  let storagePath: string;
  let workspaceRoot: string;

  beforeAll(async () => {
    storagePath = path.join(os.tmpdir(), `untitled-rate-test-${Date.now()}`);
    workspaceRoot = path.join(os.tmpdir(), `untitled-workspace-${Date.now()}`);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(storagePath, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('maxCodeBlockSize enforcement', () => {
    it('rejects code block exceeding max size', async () => {
      const config = createTestConfig({
        userId: 'rate-user',
        storagePath,
        workspaceRoot,
        apiKey: 'sk-or-v1-test-key',
        rateLimits: {
          explanationsPerHour: 100,
          explanationsPerDay: 1000,
          maxConcurrentRequests: 3,
          maxCodeBlockSize: 100,
        },
      });

      const core = new UntitledCore(config);
      await core.initialize();

      const oversizedCode = 'x'.repeat(150);

      await expect(core.explainCode(oversizedCode)).rejects.toThrow('Code block too large');
      await expect(core.explainCode(oversizedCode)).rejects.toThrow('max 100 characters');

      await core.shutdown();
    });

    it('accepts code within limit', async () => {
      const config = createTestConfig({
        userId: 'rate-user-2',
        storagePath,
        workspaceRoot,
        apiKey: 'sk-or-v1-test-key-valid',
        rateLimits: {
          explanationsPerHour: 100,
          explanationsPerDay: 1000,
          maxConcurrentRequests: 3,
          maxCodeBlockSize: 50_000,
        },
      });

      const core = new UntitledCore(config);
      await core.initialize();

      const smallCode = 'const x = 1;';
      await expect(core.explainCode(smallCode)).resolves.toBeDefined();

      await core.shutdown();
    });
  });

  describe('Rate limit config', () => {
    it('config includes explanationsPerHour and explanationsPerDay', () => {
      const config = createTestConfig();
      expect(config.rateLimits.explanationsPerHour).toBeDefined();
      expect(config.rateLimits.explanationsPerDay).toBeDefined();
      expect(typeof config.rateLimits.explanationsPerHour).toBe('number');
      expect(typeof config.rateLimits.explanationsPerDay).toBe('number');
    });
  });
});
