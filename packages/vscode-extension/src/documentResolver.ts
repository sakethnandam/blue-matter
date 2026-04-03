/**
 * DocumentResolver — normalizes "where is the user and what did they select?"
 * across regular files, Jupyter notebook cells, and # %% Python cell-mode files.
 *
 * VS Code uses vscode-notebook-cell:// URIs for notebook cell documents.
 * This module is the only place that handles notebook-specific VS Code API calls;
 * everything else (context building, prompts, caching) stays in @blue-matter/core.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { NotebookCellContext } from '@blue-matter/core';

export const ALLOWED_SCHEMES = ['file', 'untitled', 'vscode-notebook-cell'] as const;

export interface ResolvedSelection {
  code: string;
  language: string;
  /** Absolute path to the file or notebook on disk. */
  filePath: string;
  /** Present when code comes from a notebook cell or # %% Python cell-mode file. */
  notebookContext?: NotebookCellContext;
}

/**
 * Resolve selection from CodeLens arguments (URI string + range object).
 * Returns null and shows a warning if the document/range is invalid or out of workspace.
 */
export async function resolveFromArgs(
  uriString: string,
  rangeArg: { start: { line: number; character: number }; end: { line: number; character: number } }
): Promise<ResolvedSelection | null> {
  const uri = vscode.Uri.parse(uriString);

  if (!(ALLOWED_SCHEMES as readonly string[]).includes(uri.scheme)) {
    vscode.window.showWarningMessage('Blue Matter: Document is not in the workspace.');
    return null;
  }

  // For notebook cells, derive the effective notebook file URI for workspace checks
  const effectiveFileUri = uri.scheme === 'vscode-notebook-cell'
    ? vscode.Uri.file(uri.fsPath)
    : uri;

  // Workspace folder check (only for file-scheme documents when a workspace is open)
  if (uri.scheme === 'file' && vscode.workspace.workspaceFolders?.length) {
    const inWorkspace = vscode.workspace.getWorkspaceFolder(effectiveFileUri);
    if (!inWorkspace) {
      const docPath = path.normalize(uri.fsPath);
      const underFolder = vscode.workspace.workspaceFolders.some((folder) => {
        const root = path.normalize(folder.uri.fsPath);
        return docPath === root || docPath.startsWith(root + path.sep);
      });
      if (!underFolder) {
        vscode.window.showWarningMessage('Blue Matter: Document is not in the workspace.');
        return null;
      }
    }
  }

  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(uri);
  } catch {
    vscode.window.showWarningMessage('Blue Matter: Could not open document.');
    return null;
  }

  const range = clampRange(
    document,
    new vscode.Range(
      Math.max(0, rangeArg.start.line),
      Math.max(0, rangeArg.start.character),
      Math.max(0, rangeArg.end.line),
      Math.max(0, rangeArg.end.character)
    )
  );
  if (!range) {
    vscode.window.showWarningMessage('Blue Matter: Invalid selection.');
    return null;
  }

  const code = document.getText(range);
  // uri.fsPath on a vscode-notebook-cell URI correctly gives the notebook file path
  const filePath = document.uri.fsPath;
  const language = document.languageId;

  const notebookContext =
    uri.scheme === 'vscode-notebook-cell'
      ? buildNotebookCellContext(document)
      : buildPyCellModeContext(document, range.start.line);

  return { code, language, filePath, notebookContext };
}

/**
 * Resolve selection from the active text editor (keyboard shortcut path).
 * Returns null and shows a warning if nothing useful is available.
 */
export function resolveFromActiveEditor(): ResolvedSelection | null {
  let editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    editor = vscode.window.visibleTextEditors.find((e) => !e.selection.isEmpty);
  }
  if (!editor) return null;

  const selection = editor.selection;
  const code = editor.document.getText(selection);
  if (!code.trim()) return null;

  // fsPath works for both file:// and vscode-notebook-cell:// (gives the notebook file path)
  const filePath = editor.document.uri.fsPath;
  const language = editor.document.languageId;

  const notebookContext =
    editor.document.uri.scheme === 'vscode-notebook-cell'
      ? buildNotebookCellContext(editor.document)
      : buildPyCellModeContext(editor.document, selection.start.line);

  return { code, language, filePath, notebookContext };
}

// ---------------------------------------------------------------------------
// Notebook cell context helpers
// ---------------------------------------------------------------------------

function buildNotebookCellContext(cellDocument: vscode.TextDocument): NotebookCellContext | undefined {
  const notebookEditor = vscode.window.activeNotebookEditor;
  if (!notebookEditor) return undefined;

  const cells = notebookEditor.notebook.getCells();
  const cellUri = cellDocument.uri.toString();

  const activeCell = cells.find(
    (c) => c.document.uri.toString() === cellUri
  );
  if (!activeCell) return undefined;

  const cellIndex = activeCell.index;

  return {
    cellIndex,
    cellKind: activeCell.kind === vscode.NotebookCellKind.Markup ? 'markup' : 'code',
    totalCells: cells.length,
    precedingCells: cells
      .filter((c) => c.index < cellIndex)
      .map((c) => ({
        index: c.index,
        kind: c.kind === vscode.NotebookCellKind.Markup ? 'markup' as const : 'code' as const,
        source: c.document.getText(),
      })),
  };
}

/**
 * For .py files with # %% markers, determine which cell the cursor is in
 * and return the context of preceding cells.
 */
function buildPyCellModeContext(
  document: vscode.TextDocument,
  cursorLine: number
): NotebookCellContext | undefined {
  // Only applies to Python files
  if (document.languageId !== 'python') return undefined;

  const fullText = document.getText();

  // Check for # %% markers
  if (!/^# %%/m.test(fullText)) return undefined;

  const lines = fullText.split('\n');

  // Find all # %% marker positions
  const markers: Array<{ line: number; kind: 'code' | 'markup' }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^# %%/.test(lines[i])) {
      const isMarkdown = /\[markdown\]/i.test(lines[i]);
      markers.push({ line: i, kind: isMarkdown ? 'markup' : 'code' });
    }
  }

  if (markers.length === 0) return undefined;

  // Build cell boundaries
  interface Boundary { startLine: number; endLine: number; kind: 'code' | 'markup' }
  const boundaries: Boundary[] = [];

  if (markers[0].line > 0) {
    boundaries.push({ startLine: 0, endLine: markers[0].line - 1, kind: 'code' });
  }
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].line;
    const end = i + 1 < markers.length ? markers[i + 1].line - 1 : lines.length - 1;
    boundaries.push({ startLine: start, endLine: end, kind: markers[i].kind });
  }

  // Find active cell
  const activeCellIdx = boundaries.findIndex(
    (b) => cursorLine >= b.startLine && cursorLine <= b.endLine
  );
  if (activeCellIdx === -1) return undefined;

  const activeCell = boundaries[activeCellIdx];

  return {
    cellIndex: activeCellIdx,
    cellKind: activeCell.kind,
    totalCells: boundaries.length,
    precedingCells: boundaries.slice(0, activeCellIdx).map((b, idx) => {
      // Skip the # %% marker line when extracting source
      const startLine = lines[b.startLine]?.trimStart().startsWith('# %%')
        ? b.startLine + 1
        : b.startLine;
      return {
        index: idx,
        kind: b.kind,
        source: lines.slice(startLine, b.endLine + 1).join('\n'),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clampRange(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
  const lineCount = document.lineCount;
  if (lineCount === 0) return null;
  const startLine = Math.min(range.start.line, lineCount - 1);
  const endLine = Math.min(range.end.line, lineCount - 1);
  const startChar = Math.min(range.start.character, document.lineAt(startLine).text.length);
  const endChar = Math.min(range.end.character, document.lineAt(endLine).text.length);
  if (startLine > endLine || (startLine === endLine && startChar > endChar)) return null;
  return new vscode.Range(startLine, startChar, endLine, endChar);
}
