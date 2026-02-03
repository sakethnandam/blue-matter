/**
 * Explanation cache - get/set explanations by code hash with SQLite
 */

import type { Explanation } from '../models/Explanation.js';
import type { UntitledDatabase } from '../storage/Database.js';
import { generateCodeHash, generateStructuralSignature } from './HashGenerator.js';
import { createExplanation } from '../models/Explanation.js';

export interface CacheEntry {
  id: string;
  code_hash: string;
  structural_signature: string;
  text: string;
  summary: string;
  concepts: string | null;
  confidence: number;
  source: string;
  related_symbols: string | null;
  related_files: string | null;
  metadata: string | null;
  created_at: number;
  accessed_at: number;
  access_count: number;
}

export class ExplanationCache {
  constructor(
    private readonly db: UntitledDatabase,
    private readonly userId: string
  ) {}

  generateHash(code: string): string {
    return generateCodeHash(code);
  }

  get(codeHash: string): Explanation | null {
    const row = this.db.get<CacheEntry>(
      'SELECT * FROM explanations WHERE user_id = ? AND code_hash = ?',
      this.userId,
      codeHash
    );
    if (!row) return null;
    this.db.run(
      'UPDATE explanations SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?',
      Date.now(),
      row.id
    );
    return this.rowToExplanation(row);
  }

  set(explanation: Explanation): void {
    this.db.run(
      `INSERT OR REPLACE INTO explanations (id, user_id, code_hash, structural_signature, text, summary, concepts, confidence, source, related_symbols, related_files, metadata, created_at, accessed_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      explanation.id,
      this.userId,
      explanation.codeHash,
      generateStructuralSignature(explanation.text),
      explanation.text,
      explanation.summary,
      JSON.stringify(explanation.concepts),
      explanation.confidence,
      explanation.source,
      JSON.stringify(explanation.relatedSymbols),
      JSON.stringify(explanation.relatedFiles),
      JSON.stringify(explanation.metadata),
      explanation.createdAt.getTime(),
      explanation.accessedAt.getTime(),
      explanation.accessCount
    );
  }

  findSimilar(code: string, _threshold = 0.8): Explanation[] {
    const hash = generateCodeHash(code);
    const rows = this.db.all<CacheEntry>(
      `SELECT * FROM explanations WHERE user_id = ? AND code_hash != ? ORDER BY accessed_at DESC LIMIT 5`,
      this.userId,
      hash
    );
    return rows.map((r) => this.rowToExplanation(r));
  }

  getStats(): { total: number; recentCount: number } {
    const total = (this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM explanations WHERE user_id = ?', this.userId)?.count) ?? 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = (this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM explanations WHERE user_id = ? AND accessed_at > ?', this.userId, thirtyDaysAgo)?.count) ?? 0;
    return { total, recentCount };
  }

  private rowToExplanation(row: CacheEntry): Explanation {
    return createExplanation({
      id: row.id,
      codeHash: row.code_hash,
      text: row.text,
      summary: row.summary,
      concepts: row.concepts ? JSON.parse(row.concepts) : [],
      confidence: row.confidence,
      source: row.source as Explanation['source'],
      relatedSymbols: row.related_symbols ? JSON.parse(row.related_symbols) : [],
      relatedFiles: row.related_files ? JSON.parse(row.related_files) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : { language: 'unknown' },
      createdAt: new Date(row.created_at),
      accessedAt: new Date(row.accessed_at),
      accessCount: row.access_count,
    });
  }
}
