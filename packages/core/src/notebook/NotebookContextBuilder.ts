import { createHash } from 'node:crypto';
import type { NotebookCellContext } from '../models/Context.js';
import { PyCellParser } from './PyCellParser.js';

const MAX_SUMMARY_CHARS = 2000;
const MAX_IMPORTS_PER_CELL = 6;
const MAX_NAMES_PER_KIND = 4;

interface SymbolLabel {
  singular: string;
  plural: string;
}

// Format one symbol group (imports / functions / classes / variables) into a summary fragment.
// Returns null when the list is empty so callers can filter cleanly.
function formatSymbolGroup(
  names: string[],
  max: number,
  verb: string,
  label?: SymbolLabel
): string | null {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const suffix = names.length > max ? ', ...' : '';
  let kind = '';
  if (label) {
    kind = ` ${names.length > 1 ? label.plural : label.singular}`;
  }
  return `${verb}${kind} ${shown.join(', ')}${suffix}`;
}

export class NotebookContextBuilder {
  private readonly parser = new PyCellParser();

  /**
   * Build a plain-text summary of imports, functions, classes, and variables
   * defined in preceding code cells. Returns an empty string if there are none.
   */
  buildSummary(ctx: NotebookCellContext): string {
    const codeCells = ctx.precedingCells.filter((c) => c.kind === 'code');
    if (codeCells.length === 0) return '';

    const lines: string[] = ['Notebook context (preceding cells):'];

    for (const cell of codeCells) {
      const sym = this.parser.extractSymbols(cell.source);

      const parts = [
        formatSymbolGroup(sym.imports, MAX_IMPORTS_PER_CELL, 'imports'),
        formatSymbolGroup(sym.functions, MAX_NAMES_PER_KIND, 'defines', { singular: 'function', plural: 'functions' }),
        formatSymbolGroup(sym.classes, MAX_NAMES_PER_KIND, 'defines', { singular: 'class', plural: 'classes' }),
        formatSymbolGroup(sym.variables, MAX_NAMES_PER_KIND, 'assigns'),
      ].filter(Boolean) as string[];

      if (parts.length > 0) {
        lines.push(`- Cell ${cell.index}: ${parts.join('; ')}`);
      }
    }

    if (lines.length === 1) return '';
    return lines.join('\n').slice(0, MAX_SUMMARY_CHARS);
  }

  /**
   * SHA-256 of the dependency summary.
   * Use this as the extra context when generating notebook-aware cache keys.
   */
  buildSummaryHash(ctx: NotebookCellContext): string {
    const summary = this.buildSummary(ctx);
    return createHash('sha256').update(summary).digest('hex');
  }
}
