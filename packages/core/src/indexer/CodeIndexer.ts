/**
 * Code indexer - orchestrates file discovery and symbol indexing
 */

import type { Symbol } from '../models/Symbol.js';
import type { BlueMatterDatabase } from '../storage/Database.js';
import type { IndexingConfig } from '../models/Config.js';
import { FileDiscovery } from './FileDiscovery.js';
import { GenericParser } from './parsers/GenericParser.js';
import type { ParseResult } from './parsers/Parser.interface.js';
import { createLogger } from '../utils/Logger.js';

export interface IndexResult {
  filesIndexed: number;
  symbolsExtracted: number;
  duration: number;
  errors: IndexError[];
}

export interface IndexError {
  filePath: string;
  message: string;
}

export interface IndexStatus {
  isIndexing: boolean;
  progress: number;
  filesIndexed: number;
  totalFiles: number;
  currentFile?: string;
}

export class CodeIndexer {
  private readonly discovery = new FileDiscovery();
  private readonly parser = new GenericParser();
  private readonly logger = createLogger();
  private indexingAborted = false;
  private status: IndexStatus = {
    isIndexing: false,
    progress: 0,
    filesIndexed: 0,
    totalFiles: 0,
  };

  constructor(
    private readonly db: BlueMatterDatabase,
    private readonly userId: string,
    private readonly config: IndexingConfig
  ) {}

  async indexRepository(rootPath: string): Promise<IndexResult> {
    if (this.status.isIndexing) {
      throw new Error('Indexing already in progress');
    }
    this.indexingAborted = false;
    this.status = { isIndexing: true, progress: 0, filesIndexed: 0, totalFiles: 0 };
    const start = Date.now();
    const errors: IndexError[] = [];

    try {
      const files = await this.discovery.discoverFiles(rootPath, {
        exclude: this.config.excludePatterns,
        maxFiles: this.config.maxFilesToIndex,
        maxTotalSizeBytes: this.config.maxTotalSizeBytes,
      });
      this.status.totalFiles = files.length;
      let symbolsExtracted = 0;
      const batchSize = 10;

      for (let i = 0; i < files.length && !this.indexingAborted; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (filePath) => {
            this.status.currentFile = filePath;
            try {
              const count = await this.indexFile(filePath);
              symbolsExtracted += count;
            } catch (err) {
              errors.push({
                filePath,
                message: err instanceof Error ? err.message : String(err),
              });
              this.logger.warn('Index error', { filePath, error: String(err) });
            }
          })
        );
        this.status.filesIndexed = Math.min(i + batch.length, files.length);
        this.status.progress = this.status.filesIndexed / files.length;
        await this.yield();
      }

      const duration = Date.now() - start;
      this.status = { isIndexing: false, progress: 1, filesIndexed: files.length, totalFiles: files.length };
      this.logger.info('Indexing complete', { filesIndexed: files.length, symbolsExtracted, duration });
      return {
        filesIndexed: files.length,
        symbolsExtracted,
        duration,
        errors,
      };
    } finally {
      this.status.isIndexing = false;
    }
  }

  async indexFile(filePath: string): Promise<number> {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath, 'utf-8').catch(() => '');
    if (!this.parser.canParse(filePath)) return 0;
    const result = this.parser.parse(content, filePath);
    return this.persistSymbols(filePath, result);
  }

  private persistSymbols(filePath: string, result: ParseResult): number {
    this.db.run('DELETE FROM symbols WHERE user_id = ? AND file_path = ?', this.userId, filePath);
    for (const sym of result.symbols) {
      this.db.run(
        `INSERT OR REPLACE INTO symbols (id, user_id, file_path, symbol_name, symbol_type, line_start, line_end, definition, signature, documentation, dependencies, exports, metadata, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sym.id,
        this.userId,
        sym.filePath,
        sym.name,
        sym.type,
        sym.lineStart,
        sym.lineEnd,
        sym.definition ?? '',
        sym.signature ?? null,
        sym.documentation ?? null,
        JSON.stringify(sym.dependencies ?? []),
        sym.exports ? JSON.stringify(sym.exports) : null,
        JSON.stringify(sym.metadata ?? {}),
        Date.now()
      );
    }
    return result.symbols.length;
  }

  getIndexStatus(): IndexStatus {
    return { ...this.status };
  }

  getSymbolsForFile(filePath: string): Symbol[] {
    const rows = this.db.all<{
      id: string;
      file_path: string;
      symbol_name: string;
      symbol_type: string;
      line_start: number;
      line_end: number;
      definition: string;
      signature: string | null;
      documentation: string | null;
      dependencies: string;
      exports: string | null;
      metadata: string;
    }>('SELECT * FROM symbols WHERE user_id = ? AND file_path = ?', this.userId, filePath);
    return rows.map((r) => ({
      id: r.id,
      name: r.symbol_name,
      type: r.symbol_type as Symbol['type'],
      filePath: r.file_path,
      lineStart: r.line_start,
      lineEnd: r.line_end,
      definition: r.definition,
      signature: r.signature ?? undefined,
      documentation: r.documentation ?? undefined,
      dependencies: JSON.parse(r.dependencies || '[]'),
      exports: r.exports ? JSON.parse(r.exports) : undefined,
      metadata: JSON.parse(r.metadata || '{}'),
    })) as Symbol[];
  }

  getIndexedFiles(): Array<{ path: string; exports: string[]; language: string }> {
    const rows = this.db.all<{ file_path: string; symbol_name: string; symbol_type: string; metadata: string }>(
      'SELECT file_path, symbol_name, metadata FROM symbols WHERE user_id = ?',
      this.userId
    );
    const byFile = new Map<string, { exports: string[]; language: string }>();
    for (const r of rows) {
      const meta = (() => {
        try {
          return JSON.parse(r.metadata || '{}') as { isExported?: boolean; language?: string };
        } catch {
          return {};
        }
      })();
      if (!byFile.has(r.file_path)) byFile.set(r.file_path, { exports: [], language: meta.language ?? 'unknown' });
      const entry = byFile.get(r.file_path)!;
      if (meta.isExported) entry.exports.push(r.symbol_name);
    }
    return [...byFile.entries()].map(([path, { exports, language }]) => ({ path, exports, language }));
  }

  findSymbol(name: string): Symbol | undefined {
    const row = this.db.get<{
      id: string;
      file_path: string;
      symbol_name: string;
      symbol_type: string;
      line_start: number;
      line_end: number;
      definition: string;
      signature: string | null;
      documentation: string | null;
      dependencies: string;
      exports: string | null;
      metadata: string;
    }>('SELECT * FROM symbols WHERE user_id = ? AND symbol_name = ? LIMIT 1', this.userId, name);
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.symbol_name,
      type: row.symbol_type as Symbol['type'],
      filePath: row.file_path,
      lineStart: row.line_start,
      lineEnd: row.line_end,
      definition: row.definition,
      signature: row.signature ?? undefined,
      documentation: row.documentation ?? undefined,
      dependencies: JSON.parse(row.dependencies || '[]'),
      exports: row.exports ? JSON.parse(row.exports) : undefined,
      metadata: JSON.parse(row.metadata || '{}'),
    } as Symbol;
  }

  abortIndexing(): void {
    this.indexingAborted = true;
  }

  private yield(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }
}
