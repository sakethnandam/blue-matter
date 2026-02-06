/**
 * Repo map generator - builds compact text representation of repo structure
 */

import type { Symbol } from '../models/Symbol.js';
import type { FileInfo } from '../models/Context.js';
import * as path from 'node:path';

export function generateRepoMap(
  fileInfos: FileInfo[],
  symbols: Symbol[],
  currentFilePath?: string,
  maxEntries = 50
): string {
  const lines: string[] = [];
  const byDir = new Map<string, FileInfo[]>();
  for (const f of fileInfos.slice(0, maxEntries)) {
    const dir = path.dirname(f.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(f);
  }
  const sortedDirs = [...byDir.keys()].sort();
  for (const dir of sortedDirs) {
    const files = byDir.get(dir)!;
    const dirLabel = dir || '.';
    lines.push(`${dirLabel}/`);
    for (const f of files.sort((a, b) => a.path.localeCompare(b.path))) {
      const name = path.basename(f.path);
      const exports = f.exports.length ? ` - exports ${f.exports.join(', ')}` : '';
      lines.push(`  ${name}${exports}`);
    }
  }
  if (currentFilePath) {
    lines.push('');
    lines.push(`Current file: ${currentFilePath}`);
    const currentSymbols = symbols.filter((s) => s.filePath === currentFilePath);
    if (currentSymbols.length) {
      lines.push(`Symbols: ${currentSymbols.map((s) => `${s.name} (${s.type})`).join(', ')}`);
    }
  }
  return lines.join('\n');
}
