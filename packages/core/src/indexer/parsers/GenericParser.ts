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
    // Treat .ipynb as Python: caller passes pre-extracted code content
    const effectivePath = filePath.toLowerCase().endsWith('.ipynb')
      ? filePath.slice(0, -5) + 'py'
      : filePath;
    const lang = detectLanguage(effectivePath);
    const patterns = lang === 'python' ? PYTHON_PATTERNS : JS_TS_PATTERNS;
    const symbols: ReturnType<typeof createSymbol>[] = [];
    const relativePath = filePath.replace(/\\/g, '/'); // keep original path for storage

    for (const type of ['function', 'class'] as const) {
      for (const { name, lineStart, lineEnd } of extractWithPatterns(content, patterns, type)) {
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

    const imports = this.extractImports(content, lang);
    const exports = symbols.filter((s) => s.metadata.isExported).map((s) => s.name);

    return {
      symbols,
      language: lang,
      imports,
      exports,
    };
  }

  private extractImports(content: string, lang: string): string[] {
    const names: string[] = [];
    if (lang === 'python') {
      const importRe = /(?:from\s+[\w.]+\s+)?import\s+(.+)/g;
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(content)) !== null) {
        const part = m[1].replace(/\s+as\s+\w+/, '').trim();
        for (const name of part.split(',').map((s) => s.trim().split(/\s+as\s+/)[0])) {
          if (name && !name.startsWith('*')) names.push(name);
        }
      }
    } else {
      const importRe = /import\s+(?:\{([^}]+)\}|(\w+)|(\w+)\s+as\s+\w+)\s+from\s+['"][^'"]+['"]/g;
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(content)) !== null) {
        const named = m[1];
        const defaultName = m[2];
        if (named) {
          for (const n of named.split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim())) {
            if (n) names.push(n);
          }
        } else if (defaultName) names.push(defaultName);
      }
    }
    return names;
  }
}
