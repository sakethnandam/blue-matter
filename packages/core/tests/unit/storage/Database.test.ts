/**
 * Unit tests for UntitledDatabase
 * Uses real sql.js with temp file for isolation
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { UntitledDatabase } from '../../../src/storage/Database';

describe('UntitledDatabase', () => {
  let dbPath: string;
  let db: UntitledDatabase;

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `untitled-db-test-${Date.now()}.db`);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new UntitledDatabase({ path: dbPath, userId: 'test-user' });
  });

  afterAll(async () => {
    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  });

  describe('open and migrations', () => {
    it('opens and db is usable', async () => {
      await db.open();
      expect(db.raw).toBeDefined();
      db.close();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('runs migrations - explanations table exists', async () => {
      await db.open();
      const raw = db.raw;
      const result = raw.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='explanations'");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('parameterized queries', () => {
    it('run accepts parameters', async () => {
      await db.open();
      const result = db.run(
        'INSERT INTO explanations (id, user_id, code_hash, structural_signature, text, summary, concepts, confidence, source, related_symbols, related_files, metadata, created_at, accessed_at, access_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'exp-1',
        'test-user',
        'hash123',
        'sig',
        'text',
        'summary',
        '[]',
        0.9,
        'ai',
        '[]',
        '[]',
        '{}',
        Date.now(),
        Date.now(),
        0
      );
      expect(result.changes).toBeGreaterThanOrEqual(0);
    });

    it('get returns row with parameters', async () => {
      await db.open();
      const row = db.get<{ code_hash: string }>(
        'SELECT code_hash FROM explanations WHERE user_id = ? AND code_hash = ?',
        'test-user',
        'hash123'
      );
      expect(row?.code_hash).toBe('hash123');
    });

    it('get returns undefined when not found', async () => {
      await db.open();
      const row = db.get('SELECT * FROM explanations WHERE code_hash = ?', 'nonexistent');
      expect(row).toBeUndefined();
    });

    it('all returns array', async () => {
      await db.open();
      const rows = db.all<{ id: string }>('SELECT id FROM explanations WHERE user_id = ?', 'test-user');
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SQL injection prevention', () => {
    it('parameterizes user input - malicious sql in param', async () => {
      await db.open();
      const malicious = "'; DROP TABLE explanations; --";
      const row = db.get('SELECT * FROM explanations WHERE code_hash = ?', malicious);
      expect(row).toBeUndefined();
      const tables = db.raw.exec("SELECT name FROM sqlite_master WHERE type='table'");
      expect(tables.some((t) => t.values.some((v) => v.includes('explanations')))).toBe(true);
    });
  });
});
