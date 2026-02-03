/**
 * Path validator - prevents path traversal and ensures paths stay within workspace
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class PathValidator {
  constructor(private readonly workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  validatePath(inputPath: string): string {
    if (typeof inputPath !== 'string' || !inputPath.trim()) {
      throw new SecurityError('Invalid path');
    }

    const trimmed = inputPath.trim();

    if (path.isAbsolute(trimmed)) {
      throw new SecurityError('Absolute paths not allowed');
    }

    if (trimmed.includes('..')) {
      throw new SecurityError('Path traversal not allowed');
    }

    const resolved = path.resolve(this.workspaceRoot, trimmed);
    const normalized = path.normalize(resolved);

    if (!normalized.startsWith(this.workspaceRoot)) {
      throw new SecurityError('Path outside workspace not allowed');
    }

    try {
      const realPath = fs.realpathSync(normalized);
      if (!realPath.startsWith(this.workspaceRoot)) {
        throw new SecurityError('Symlink escape detected');
      }
      return realPath;
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError('Invalid path');
    }
  }

  isWithinWorkspace(inputPath: string): boolean {
    try {
      const resolved = path.resolve(this.workspaceRoot, inputPath);
      const normalized = path.normalize(resolved);
      return normalized.startsWith(this.workspaceRoot);
    } catch {
      return false;
    }
  }
}
