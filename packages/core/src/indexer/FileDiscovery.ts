/**
 * File discovery - finds code files in workspace using glob patterns
 */

import fg from 'fast-glob';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface DiscoveryOptions {
  include?: string[];
  exclude?: string[];
  maxFiles?: number;
  maxTotalSizeBytes?: number;
}

const DEFAULT_INCLUDE = [
  '**/*.js',
  '**/*.ts',
  '**/*.jsx',
  '**/*.tsx',
  '**/*.py',
  '**/*.ipynb',
  '**/*.mjs',
  '**/*.cjs',
];

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/__pycache__/**',
  // Sensitive files — never index credentials, keys, or secrets
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/.ssh/**',
  '**/*.tfstate',
  '**/*.tfstate.backup',
  '**/secrets/**',
  '**/credentials/**',
];

export class FileDiscovery {
  async discoverFiles(
    rootPath: string,
    options: DiscoveryOptions = {}
  ): Promise<string[]> {
    const include = options.include ?? DEFAULT_INCLUDE;
    // Always merge with DEFAULT_EXCLUDE so sensitive file patterns are never dropped
    const customExclude = options.exclude ?? [];
    const exclude = [...new Set([...DEFAULT_EXCLUDE, ...customExclude])];
    const maxFiles = options.maxFiles ?? 10_000;
    const maxTotalSizeBytes = options.maxTotalSizeBytes ?? 50 * 1024 * 1024;

    const absoluteRoot = path.resolve(rootPath);
    const patterns = include.map((p) => path.join(absoluteRoot, p).replace(/\\/g, '/'));

    const entries = await fg(patterns, {
      cwd: absoluteRoot,
      absolute: true,
      ignore: exclude,
      onlyFiles: true,
      followSymbolicLinks: false,
    });

    let totalSize = 0;
    const result: string[] = [];
    for (const filePath of entries) {
      if (result.length >= maxFiles) break;
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        totalSize += stat.size;
        if (totalSize > maxTotalSizeBytes) break;
        result.push(filePath);
      } catch {
        // skip inaccessible files
      }
    }
    return result;
  }
}
