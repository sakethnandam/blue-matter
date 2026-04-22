/**
 * Generic parser - regex-based symbol extraction for JS/TS/Python
 */

import type { Parser, ParseResult } from './Parser.interface.js';
import { createSymbol } from '../../models/Symbol.js';

const JS_TS_PATTERNS = {
  function: [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
    /(?:export\s+)?(?:async\s+)?function\s*(\w+)\s*</g,
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/g,
    /(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/g,
  ],
  class: [
    /(?:export\s+)?class\s+(\w+)(?:\s+extends|\s+implements|\s*{)/g,
  ],
};

const PYTHON_PATTERNS = {
  function: [
    /^\s*def\s+(\w+)\s*\(/gm,
    /^\s*async\s+def\s+(\w+)\s*\(/gm,
  ],
  class: [
    /^\s*class\s+(\w+)\s*[(:]/gm,
  ],
};

function getLineRange(content: string, matchIndex: number): { start: number; end: number } {
  const before = content.slice(0, matchIndex);
  const start = before.split('\n').length;
  const firstNewline = content.indexOf('\n', matchIndex);
  const end = firstNewline === -1 ? start : content.slice(0, firstNewline).split('\n').length;
  return { start, end: Math.max(end, start + 1) };
}

function extractWithPatterns(
  content: string,
  patterns: Record<string, RegExp[]>,
  type: 'function' | 'class'
): Array<{ name: string; lineStart: number; lineEnd: number }> {
  const seen = new Set<string>();
  const results: Array<{ name: string; lineStart: number; lineEnd: number }> = [];
  for (const re of patterns[type] ?? []) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(content)) !== null) {
      const name = m[1];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const { start, end } = getLineRange(content, m.index);
      results.push({ name, lineStart: start, lineEnd: end });
    }
  }
  return results;
}

function parseJsImportClause(clause: string, names: string[]): void {
  if (clause.startsWith('type ')) return;
  const braceIdx = clause.indexOf('{');
  const closeIdx = clause.indexOf('}');
  let defaultPart: string;
  if (braceIdx > 0) {
    defaultPart = clause.slice(0, braceIdx).trim().replace(/,$/, '').trim();
  } else if (braceIdx < 0) {
    defaultPart = clause;
  } else {
    defaultPart = '';
  }
  const namedPart = braceIdx >= 0 && closeIdx > braceIdx ? clause.slice(braceIdx + 1, closeIdx) : '';
  const nsMatch = /^\*\s+as\s+(\w+)$/.exec(defaultPart);
  if (nsMatch) {
    names.push(nsMatch[1]);
  } else if (defaultPart) {
    names.push(defaultPart);
  }
  for (const n of namedPart.split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim())) {
    if (n) names.push(n);
  }
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (ext === 'py') return 'python';
  return 'unknown';
}

export class GenericParser implements Parser {
  readonly language = 'generic';
  readonly extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.ipynb'];

  canParse(filePath: string): boolean {
    const ext = filePath.toLowerCase();
    return this.extensions.some((e) => ext.endsWith(e));
  }

  parse(content: string, filePath: string): ParseResult {
    const safeContent = content.slice(0, 100_000).replaceAll('\0', '');
    const safeFilePath = filePath.replaceAll('\0', '');
    // Treat .ipynb as Python: caller passes pre-extracted code content
    const effectivePath = safeFilePath.toLowerCase().endsWith('.ipynb')
      ? safeFilePath.slice(0, -5) + 'py'
      : safeFilePath;
    const lang = detectLanguage(effectivePath);
    const patterns = lang === 'python' ? PYTHON_PATTERNS : JS_TS_PATTERNS;
    const symbols: ReturnType<typeof createSymbol>[] = [];
    const relativePath = safeFilePath.replaceAll('\\', '/'); // keep original path for storage

    for (const type of ['function', 'class'] as const) {
      for (const { name, lineStart, lineEnd } of extractWithPatterns(safeContent, patterns, type)) {
        symbols.push(
          createSymbol({
            name,
            type,
            filePath: relativePath,
            lineStart,
            lineEnd,
            definition: '',
            metadata: { language: lang, isExported: false },
          })
        );
      }
    }

    const imports = this.extractImports(safeContent, lang);
    const exports = symbols.filter((s) => s.metadata.isExported).map((s) => s.name);

    return {
      symbols,
      language: lang,
      imports,
      exports,
    };
  }

  private extractImports(content: string, lang: string): string[] {
    return lang === 'python'
      ? this.extractPythonImports(content)
      : this.extractJsImports(content);
  }

  private extractPythonImports(content: string): string[] {
    const names: string[] = [];
    // Mask triple-quoted strings so imports inside them are not extracted
    let preprocessed = content.replaceAll(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, '""');
    // Join backslash line-continuations so multi-line bare imports are captured
    preprocessed = preprocessed.replaceAll('\\\n', ' ');
    // Capture parenthesized block (spans newlines via [^)]*) or rest of line
    const importRe = /(?:from\s+[\w.]+\s+)?import\s+(\([^)]*\)|[^\n]+)/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(preprocessed)) !== null) {
      // Strip inline comments, then normalize: strip surrounding parens, collapse whitespace
      const part = m[1].trim()
        .split('\n').map((l) => l.replace(/#.*$/, '')).join('\n')
        .replaceAll(/^\(|\)$/g, '').replaceAll('\n', ' ').replaceAll(/\s+/g, ' ').trim();
      for (const name of part.split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim())) {
        if (name && !name.startsWith('*')) names.push(name);
      }
    }
    return names;
  }

  private extractJsImports(content: string): string[] {
    const names: string[] = [];
    let m: RegExpExecArray | null;
    const importRe = /import\s+([^;'"]+?)\s+from\s*['"][^'"]+['"]/g;
    while ((m = importRe.exec(content)) !== null) {
      parseJsImportClause(m[1].trim(), names);
    }
    return names;
  }
}
