/**
 * Unit tests for UntitledCore (mocked fetch for AI)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { UntitledCore } from '../../../src/core/UntitledCore';
import { createTestConfig } from '../../helpers/test-helpers';

describe('UntitledCore', () => {
  let storagePath: string;
  let workspaceRoot: string;

  beforeAll(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'This code declares a variable.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 15 },
      }),
    }) as typeof fetch;
    storagePath = path.join(os.tmpdir(), `untitled-core-test-${Date.now()}`);
    workspaceRoot = path.join(os.tmpdir(), `untitled-workspace-${Date.now()}`);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'test.ts'), 'const x = 1;');
  });

  afterAll(() => {
    try {
      fs.rmSync(storagePath, { recursive: true, force: true });
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('initialization', () => {
    it('initializes successfully', async () => {
      const config = createTestConfig({ storagePath, workspaceRoot, userId: 'core-user-1' });
      const core = new UntitledCore(config);
      await core.initialize();
      expect(core.getConfig()).toBeDefined();
      await core.shutdown();
    });
  });

  describe('explainCode', () => {
    it('returns explanation from AI', async () => {
      const config = createTestConfig({
        storagePath,
        workspaceRoot,
        userId: 'core-user-2',
        apiKey: 'sk-or-v1-test',
      });
      const core = new UntitledCore(config);
      await core.initialize();

      const result = await core.explainCode('const x = 1;');
      expect(result).toBeDefined();
      expect(result.text).toContain('variable');
      expect(result.source).toBe('ai');

      await core.shutdown();
    });

    it('returns cached result on second call', async () => {
      const config = createTestConfig({
        storagePath,
        workspaceRoot,
        userId: 'core-user-3',
        apiKey: 'sk-or-v1-test',
      });
      const core = new UntitledCore(config);
      await core.initialize();

      const code = 'const cached = 42;';
      const first = await core.explainCode(code);
      const second = await core.explainCode(code);

      expect(first.text).toBe(second.text);
      expect(second.source).toBe('ai');

      await core.shutdown();
    });

    it('getCodeHash returns hash', async () => {
      const config = createTestConfig({ storagePath, workspaceRoot, userId: 'core-user-4' });
      const core = new UntitledCore(config);
      await core.initialize();
      const hash = core.getCodeHash('const x = 1;');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      await core.shutdown();
    });
  });

  describe('annotations', () => {
    it('createAnnotation and getAnnotations', async () => {
      const config = createTestConfig({ storagePath, workspaceRoot, userId: 'core-user-5' });
      const core = new UntitledCore(config);
      await core.initialize();

      const hash = core.getCodeHash('code');
      core.createAnnotation(hash, 'My note', ['#tag']);
      const notes = core.getAnnotations(hash);
      expect(notes.length).toBeGreaterThanOrEqual(1);
      expect(notes.some((n) => n.text === 'My note')).toBe(true);

      await core.shutdown();
    });
  });

  describe('getCacheStats', () => {
    it('returns cache stats', async () => {
      const config = createTestConfig({ storagePath, workspaceRoot, userId: 'core-user-6' });
      const core = new UntitledCore(config);
      await core.initialize();

      const stats = core.getCacheStats();
      expect(stats).toHaveProperty('totalExplanations');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('costSaved');

      await core.shutdown();
    });
  });

  describe('privacy mode', () => {
    it('strict mode blocks AI calls', async () => {
      const config = createTestConfig({
        storagePath,
        workspaceRoot,
        userId: 'core-user-7',
        apiKey: 'sk-or-v1-test',
        privacyMode: 'strict',
      });
      const core = new UntitledCore(config);
      await core.initialize();

      await expect(core.explainCode('const x = 1;')).rejects.toThrow('Strict privacy mode');

      await core.shutdown();
    });
  });
});
