/**
 * PyCellParser — regex-based symbol extraction from Python cells and # %% boundary parsing.
 *
 * Tolerant of incomplete / IPython-magic-heavy notebook code.
 * Does NOT perform full AST parsing — designed to be fast (< 1ms per cell).
 */

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

export class PyCellParser {
  /**
   * Extract symbols from a single Python cell's source text.
   * Skips IPython magic lines (%, %%, !) and cell-level decorators.
   */
  extractSymbols(source: string): CellSymbols {
    const lines = source.split('\n');
    const imports: string[] = [];
    const variables: string[] = [];
    const functions: string[] = [];
    const classes: string[] = [];

    for (const line of lines) {
      const trimmed = line.trimStart();

      // Skip blank lines, comments, IPython magics, and shell commands
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('%') || trimmed.startsWith('!')) {
        continue;
      }

      // from foo import bar, baz [as x, ...]
      const fromImport = /^from\s+(\S+)\s+import\s+(.+)$/.exec(trimmed);
      if (fromImport) {
        const module = fromImport[1];
        const rawNames = fromImport[2].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        imports.push(`${rawNames.join(', ')} from ${module}`);
        continue;
      }

      // import foo [as bar], baz [as qux]
      const simpleImport = /^import\s+(.+)$/.exec(trimmed);
      if (simpleImport) {
        const parts = simpleImport[1].split(',').map((p) => p.trim()).filter(Boolean);
        imports.push(...parts);
        continue;
      }

      // Only parse top-level (non-indented) statements for variables, functions, classes
      if (line.startsWith(' ') || line.startsWith('\t')) continue;

      // def / async def
      const funcMatch = /^(?:async\s+)?def\s+(\w+)\s*\(/.exec(trimmed);
      if (funcMatch) {
        functions.push(funcMatch[1]);
        continue;
      }

      // class Foo[(...)][:]
      const classMatch = /^class\s+(\w+)\s*[:([]/.exec(trimmed);
      if (classMatch) {
        classes.push(classMatch[1]);
        continue;
      }

      // Top-level assignment: x = ... or x, y = ...
      // Exclude augmented assigns (+=, -=, etc.) and type annotations without value (:)
      const varMatch = /^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=(?![>=])/.exec(trimmed);
      if (varMatch) {
        const names = varMatch[1]
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n && n !== '_' && /^[A-Za-z_]\w*$/.test(n));
        variables.push(...names);
      }
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
      // Matches: # %%, # %% [markdown], # %% Title, # %% [markdown] Title
      const match = /^# %%(.*)$/.exec(lines[i]);
      if (!match) continue;
      const rest = match[1];
      const isMarkdown = /\[markdown\]/i.test(rest);
      const title = rest.replace(/\[markdown\]/i, '').trim() || undefined;
      markerLines.push({ lineNum: i, kind: isMarkdown ? 'markup' : 'code', title });
    }

    if (markerLines.length === 0) return [];

    const boundaries: PyCellBoundary[] = [];

    // Implicit cell: content before the first # %% marker
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
