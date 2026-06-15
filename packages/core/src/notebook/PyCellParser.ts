import { parser as pythonParser } from '@lezer/python';
import type { SyntaxNode } from '@lezer/common';

export interface CellSymbols {
  imports: string[];
  variables: string[];
  functions: string[];
  classes: string[];
}

export interface PyCellBoundary {
  startLine: number;
  endLine: number;
  kind: 'code' | 'markup';
  title?: string;
}

const MAX_PARSE_CHARS = 100_000;

// Truncate oversized source, strip null bytes, and blank IPython magic lines
// (%cmd, %%cmd, !cmd) so the Lezer parser sees valid Python.
function blankMagicLines(source: string): string {
  return source
    .slice(0, MAX_PARSE_CHARS)
    .replaceAll('\0', '')
    .split('\n')
    .map((line) => {
      const t = line.trimStart();
      return /^%%?\s*\w/.test(t) || /^!\s*\w/.test(t) ? '' : line;
    })
    .join('\n');
}

function getText(source: string, node: SyntaxNode): string {
  return source.slice(node.from, node.to);
}

function firstChildNamed(node: SyntaxNode, name: string): SyntaxNode | null {
  let c: SyntaxNode | null = node.firstChild;
  while (c) {
    if (c.type.name === name) return c;
    c = c.nextSibling;
  }
  return null;
}

function extractFunctionName(node: SyntaxNode, source: string): string | null {
  // FunctionDefinition children: [async?] def VariableName ParamList Body
  const nameNode = firstChildNamed(node, 'VariableName');
  return nameNode ? getText(source, nameNode) : null;
}

function extractClassName(node: SyntaxNode, source: string): string | null {
  // ClassDefinition children: class VariableName [ArgList] Body
  const nameNode = firstChildNamed(node, 'VariableName');
  return nameNode ? getText(source, nameNode) : null;
}

function extractImport(node: SyntaxNode, source: string): string[] {
  // Both "import x" and "from x import y" share the ImportStatement node.
  // Distinguish via a leading "from" keyword child.
  const isFromImport = node.firstChild?.type.name === 'from';

  // Normalize whitespace and strip parens to handle multi-line imports:
  //   from x import (
  //       a,
  //       b,
  //   )
  const raw = getText(source, node)
    .split('\n').map((l) => l.replace(/#.*$/, '')).join('\n')
    .replaceAll(/\s+/g, ' ').replaceAll(/[()]/g, '').trim();

  if (isFromImport) {
    const m = /^from\s+(\S+)\s+import\s+(.+)$/.exec(raw);
    if (!m) return [];
    const mod = m[1];
    const names = m[2]
      .split(',')
      .map((n) => {
        const t = n.trim();
        const parts = t.split(/\s+as\s+/);
        return parts.length === 2 ? `${parts[0].trim()} as ${parts[1].trim()}` : t;
      })
      .filter(Boolean);
    return names.length ? [`${names.join(', ')} from ${mod}`] : [];
  }

  // "import os" or "import os as o, sys"
  const withoutKeyword = raw.replace(/^import\s+/, '');
  return withoutKeyword
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

// Walk a DecoratedStatement's children for a wrapped FunctionDefinition or ClassDefinition.
function extractDecoratedStatement(
  stmt: SyntaxNode,
  source: string,
  functions: string[],
  classes: string[]
): void {
  let c: SyntaxNode | null = stmt.firstChild;
  while (c) {
    if (c.type.name === 'FunctionDefinition') {
      const name = extractFunctionName(c, source);
      if (name) functions.push(name);
    } else if (c.type.name === 'ClassDefinition') {
      const name = extractClassName(c, source);
      if (name) classes.push(name);
    }
    c = c.nextSibling;
  }
}

// Collect variable names from an AssignStatement target side (before the first AssignOp).
// Handles: x = ..., x, y = ..., a, *b, c = ..., x: T = ...
function extractAssignTargets(node: SyntaxNode, source: string): string[] {
  const names: string[] = [];
  let c: SyntaxNode | null = node.firstChild;
  while (c && c.type.name !== 'AssignOp') {
    if (c.type.name === 'VariableName') {
      const name = getText(source, c);
      if (name !== '_') names.push(name);
    }
    c = c.nextSibling;
  }
  return names;
}

export class PyCellParser {
  /**
   * Extract top-level symbols from a Python cell using a full AST parser.
   * Handles multi-line imports, type annotations, decorators, and starred unpacking.
   * IPython magic lines (%, %%, !) are blanked before parsing.
   */
  extractSymbols(source: string): CellSymbols {
    const processed = blankMagicLines(source);
    const tree = pythonParser.parse(processed);

    const imports: string[] = [];
    const variables: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];

    let stmt: SyntaxNode | null = tree.topNode.firstChild;
    while (stmt) {
      switch (stmt.type.name) {
        case 'ImportStatement':
          imports.push(...extractImport(stmt, processed));
          break;

        case 'FunctionDefinition': {
          const name = extractFunctionName(stmt, processed);
          if (name) functions.push(name);
          break;
        }

        case 'ClassDefinition': {
          const name = extractClassName(stmt, processed);
          if (name) classes.push(name);
          break;
        }

        case 'AssignStatement':
          variables.push(...extractAssignTargets(stmt, processed));
          break;

        case 'DecoratedStatement':
          extractDecoratedStatement(stmt, processed, functions, classes);
          break;
      }
      stmt = stmt.nextSibling;
    }

    return {
      imports: [...new Set(imports)],
      variables: [...new Set(variables)],
      functions: [...new Set(functions)],
      classes: [...new Set(classes)],
    };
  }

  /**
   * Returns true if the source file uses # %% cell markers.
   */
  isCellModeFile(source: string): boolean {
    return /^# %%/m.test(source);
  }

  /**
   * Split a .py file into cells based on # %% markers.
   * Content before the first marker is treated as an implicit code cell (index 0).
   * Returns an empty array if no markers are found.
   */
  parseCellBoundaries(source: string): PyCellBoundary[] {
    const lines = source.split('\n');
    const markerLines: Array<{ lineNum: number; kind: 'code' | 'markup'; title?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = /^# %%(.*)$/.exec(lines[i]);
      if (!match) continue;
      const rest = match[1];
      const isMarkdown = /\[markdown\]/i.test(rest);
      const title = rest.replace(/\[markdown\]/i, '').trim() || undefined;
      markerLines.push({ lineNum: i, kind: isMarkdown ? 'markup' : 'code', title });
    }

    if (markerLines.length === 0) return [];

    const boundaries: PyCellBoundary[] = [];

    if (markerLines[0].lineNum > 0) {
      boundaries.push({ startLine: 0, endLine: markerLines[0].lineNum - 1, kind: 'code' });
    }

    for (let i = 0; i < markerLines.length; i++) {
      const start = markerLines[i].lineNum;
      const end = i + 1 < markerLines.length ? markerLines[i + 1].lineNum - 1 : lines.length - 1;
      boundaries.push({ startLine: start, endLine: end, kind: markerLines[i].kind, title: markerLines[i].title });
    }

    return boundaries;
  }

  /**
   * Return the boundary containing the given (0-based) line number, or null.
   */
  getCellAtLine(boundaries: PyCellBoundary[], line: number): PyCellBoundary | null {
    for (const cell of boundaries) {
      if (line >= cell.startLine && line <= cell.endLine) return cell;
    }
    return null;
  }

  /**
   * Extract the source text of a cell, skipping the # %% marker line if present.
   */
  getCellSource(allLines: string[], cell: PyCellBoundary): string {
    const skipMarker = allLines[cell.startLine]?.trimStart().startsWith('# %%');
    const start = skipMarker ? cell.startLine + 1 : cell.startLine;
    return allLines.slice(start, cell.endLine + 1).join('\n');
  }
}
