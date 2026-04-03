/**
 * NotebookContextBuilder — produces a compact dependency summary from preceding notebook cells.
 *
 * Summary is capped at MAX_SUMMARY_CHARS (~500 tokens) regardless of notebook size.
 * Hash is computed over the summary text, not raw cell code, so editing a cell's comments
 * without changing its imports/definitions preserves downstream cache entries.
 */

import { createHash } from 'node:crypto';
import type { NotebookCellContext } from '../models/Context.js';
import { PyCellParser } from './PyCellParser.js';

const MAX_SUMMARY_CHARS = 2000;
const MAX_IMPORTS_PER_CELL = 6;
const MAX_NAMES_PER_KIND = 4;

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
      const parts: string[] = [];

      if (sym.imports.length > 0) {
        const shown = sym.imports.slice(0, MAX_IMPORTS_PER_CELL);
        const suffix = sym.imports.length > MAX_IMPORTS_PER_CELL ? ', ...' : '';
        parts.push(`imports ${shown.join(', ')}${suffix}`);
      }
      if (sym.functions.length > 0) {
        const shown = sym.functions.slice(0, MAX_NAMES_PER_KIND);
        const suffix = sym.functions.length > MAX_NAMES_PER_KIND ? ', ...' : '';
        const label = sym.functions.length > 1 ? 'functions' : 'function';
        parts.push(`defines ${label} ${shown.join(', ')}${suffix}`);
      }
      if (sym.classes.length > 0) {
        const shown = sym.classes.slice(0, MAX_NAMES_PER_KIND);
        const suffix = sym.classes.length > MAX_NAMES_PER_KIND ? ', ...' : '';
        const label = sym.classes.length > 1 ? 'classes' : 'class';
        parts.push(`defines ${label} ${shown.join(', ')}${suffix}`);
      }
      if (sym.variables.length > 0) {
        const shown = sym.variables.slice(0, MAX_NAMES_PER_KIND);
        const suffix = sym.variables.length > MAX_NAMES_PER_KIND ? ', ...' : '';
        parts.push(`assigns ${shown.join(', ')}${suffix}`);
      }

      if (parts.length > 0) {
        lines.push(`- Cell ${cell.index}: ${parts.join('; ')}`);
      }
    }

    if (lines.length === 1) return ''; // no extractable content
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
