/**
 * SQLite database wrapper for Blue Matter storage (sql.js - no native bindings)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { MIGRATIONS } from './Migration.js';

export interface DatabaseConfig {
  path: string;
  userId: string;
}

type SqlJsDatabase = import('sql.js').Database;
type SqlParam = string | number | null;

export class BlueMatterDatabase {
  private db: SqlJsDatabase | null = null;
  private readonly dbPath: string;
  private readonly userId: string;
  private initPromise: Promise<void> | null = null;

  constructor(config: DatabaseConfig) {
    this.userId = config.userId;
    const dir = path.dirname(config.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbPath = config.path;
  }

  async open(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doOpen();
    return this.initPromise;
  }

  private async doOpen(): Promise<void> {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    let buffer: Uint8Array | null = null;
    if (fs.existsSync(this.dbPath)) {
      buffer = new Uint8Array(fs.readFileSync(this.dbPath));
    }
    this.db = new SQL.Database(buffer ?? undefined);
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
    this.runMigrations();
  }

  close(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } finally {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  get userId_(): string {
    return this.userId;
  }

  get raw(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not open');
    return this.db;
  }

  private runMigrations(): void {
    if (!this.db) return;
    for (const sql of MIGRATIONS) {
      this.db.exec(sql);
    }
  }

  private ensureOpen(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not open. Call open() first.');
    return this.db;
  }

  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
    const db = this.ensureOpen();
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as SqlParam[]);
      stmt.step();
      const changes = db.getRowsModified();
      const rowidResult = db.exec('SELECT last_insert_rowid() as lastInsertRowid');
      const lastInsertRowid = rowidResult.length > 0 && rowidResult[0].values[0]?.[0] != null
        ? Number(rowidResult[0].values[0][0])
        : 0;
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  get<T>(sql: string, ...params: unknown[]): T | undefined {
    const db = this.ensureOpen();
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as SqlParam[]);
      if (!stmt.step()) return undefined;
      return stmt.getAsObject() as T;
    } finally {
      stmt.free();
    }
  }

  all<T>(sql: string, ...params: unknown[]): T[] {
    const db = this.ensureOpen();
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as SqlParam[]);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }
}
