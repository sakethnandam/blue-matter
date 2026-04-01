/**
 * Annotation manager - user-created notes on code
 */

import type { UntitledDatabase } from '../storage/Database.js';
import { InputSanitizer } from '../security/InputSanitizer.js';

export interface Annotation {
  id: string;
  userId: string;
  codeHash: string;
  text: string;
  tags: string[];
  createdAt: number;
  updatedAt?: number;
}

export class AnnotationManager {
  private readonly sanitizer = new InputSanitizer();

  constructor(
    private readonly db: UntitledDatabase,
    private readonly userId: string
  ) {}

  createAnnotation(codeHash: string, text: string, tags: string[] = []): Annotation {
    const sanitized = this.sanitizer.sanitizeAnnotation(text);
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    this.db.run(
      'INSERT INTO annotations (id, user_id, code_hash, text, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      this.userId,
      codeHash,
      sanitized,
      JSON.stringify(tags),
      now,
      now
    );
    return { id, userId: this.userId, codeHash, text: sanitized, tags, createdAt: now, updatedAt: now };
  }

  getAnnotations(codeHash: string): Annotation[] {
    const rows = this.db.all<{ id: string; code_hash: string; text: string; tags: string; created_at: number; updated_at: number | null }>(
      'SELECT id, code_hash, text, tags, created_at, updated_at FROM annotations WHERE user_id = ? AND code_hash = ? ORDER BY created_at DESC',
      this.userId,
      codeHash
    );
    return rows.map((r) => ({
      id: r.id,
      userId: this.userId,
      codeHash: r.code_hash,
      text: r.text,
      tags: JSON.parse(r.tags || '[]') as string[],
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined,
    }));
  }

  searchAnnotations(query: string): Annotation[] {
    // Escape LIKE metacharacters so user query cannot match all rows via % or _
    const escaped = query.trim()
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    const rows = this.db.all<{ id: string; code_hash: string; text: string; tags: string; created_at: number; updated_at: number | null }>(
      "SELECT id, code_hash, text, tags, created_at, updated_at FROM annotations WHERE user_id = ? AND (text LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 100",
      this.userId,
      pattern,
      pattern
    );
    return rows.map((r) => ({
      id: r.id,
      userId: this.userId,
      codeHash: r.code_hash,
      text: r.text,
      tags: JSON.parse(r.tags || '[]') as string[],
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined,
    }));
  }

  updateAnnotation(id: string, text: string, tags?: string[]): void {
    const sanitized = this.sanitizer.sanitizeAnnotation(text);
    const tagsJson = tags !== undefined ? JSON.stringify(tags) : undefined;
    if (tagsJson !== undefined) {
      this.db.run('UPDATE annotations SET text = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?', sanitized, tagsJson, Date.now(), id, this.userId);
    } else {
      this.db.run('UPDATE annotations SET text = ?, updated_at = ? WHERE id = ? AND user_id = ?', sanitized, Date.now(), id, this.userId);
    }
  }

  deleteAnnotation(id: string): void {
    this.db.run('DELETE FROM annotations WHERE id = ? AND user_id = ?', id, this.userId);
  }
}
