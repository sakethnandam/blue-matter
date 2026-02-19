/**
 * Unit tests for ExplanationCache (mocked Database)
 */

import { ExplanationCache } from '../../../src/cache/ExplanationCache';
import { createExplanation } from '../../../src/models/Explanation';
import { generateCodeHash } from '../../../src/cache/HashGenerator';
import type { UntitledDatabase } from '../../../src/storage/Database';

function createMockDb(): UntitledDatabase {
  return {
    get: jest.fn(),
    all: jest.fn().mockReturnValue([]),
    run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  } as unknown as UntitledDatabase;
}

describe('ExplanationCache', () => {
  let mockDb: UntitledDatabase;
  let cache: ExplanationCache;

  const sampleExplanation = createExplanation({
    codeHash: 'abc123',
    text: 'This code does X.',
    summary: 'This code does X.',
    source: 'ai',
  });

  beforeEach(() => {
    mockDb = createMockDb();
    cache = new ExplanationCache(mockDb, 'user-1');
  });

  describe('generateHash', () => {
    it('delegates to generateCodeHash', () => {
      const code = 'const x = 1;';
      const hash = cache.generateHash(code);
      expect(hash).toBe(generateCodeHash(code));
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('get', () => {
    it('returns null when not cached', () => {
      (mockDb.get as jest.Mock).mockReturnValue(undefined);
      const result = cache.get('nonexistent-hash');
      expect(result).toBeNull();
    });

    it('returns cached explanation when found', () => {
      const row = {
        id: sampleExplanation.id,
        code_hash: sampleExplanation.codeHash,
        structural_signature: 'sig',
        text: sampleExplanation.text,
        summary: sampleExplanation.summary,
        concepts: JSON.stringify([]),
        confidence: 0.9,
        source: 'ai',
        related_symbols: JSON.stringify([]),
        related_files: JSON.stringify([]),
        metadata: JSON.stringify({ language: 'js' }),
        created_at: sampleExplanation.createdAt.getTime(),
        accessed_at: sampleExplanation.accessedAt.getTime(),
        access_count: 0,
      };
      (mockDb.get as jest.Mock).mockReturnValue(row);

      const result = cache.get(sampleExplanation.codeHash);
      expect(result).not.toBeNull();
      expect(result?.codeHash).toBe(sampleExplanation.codeHash);
      expect(result?.text).toBe(sampleExplanation.text);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('calls db.run with correct params', () => {
      cache.set(sampleExplanation);
      expect(mockDb.run).toHaveBeenCalled();
      const runCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(runCall[0]).toContain('INSERT OR REPLACE');
      expect(runCall[1]).toBe(sampleExplanation.id);
      expect(runCall[2]).toBe('user-1');
      expect(runCall[3]).toBe(sampleExplanation.codeHash);
    });
  });

  describe('findSimilar', () => {
    it('queries with user id and hash', () => {
      cache.findSimilar('code');
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        'user-1',
        expect.any(String)
      );
    });

    it('returns empty array when no similar', () => {
      const result = cache.findSimilar('some code');
      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('returns total and recentCount', () => {
      (mockDb.get as jest.Mock)
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 2 });
      const stats = cache.getStats();
      expect(stats).toEqual({ total: 5, recentCount: 2 });
    });

    it('handles undefined count', () => {
      (mockDb.get as jest.Mock).mockReturnValue(undefined);
      const stats = cache.getStats();
      expect(stats).toEqual({ total: 0, recentCount: 0 });
    });
  });
});
