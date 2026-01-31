import * as vscode from 'vscode';

let lastDocumentUri: string | undefined;
let lastSelection: { start: { line: number; character: number }; end: { line: number; character: number } } | undefined;
let lastWasSelection: boolean = false;

export function setLastEditorContext(
  editor: vscode.TextEditor,
  isSelection: boolean
): void {
  lastDocumentUri = editor.document.uri.toString();
  lastSelection = {
    start: { line: editor.selection.start.line, character: editor.selection.start.character },
    end: { line: editor.selection.end.line, character: editor.selection.end.character },
  };
  lastWasSelection = isSelection;
}

export function getLastEditorContext(): {
  uri: string | undefined;
  selection: typeof lastSelection;
  isSelection: boolean;
} {
  return { uri: lastDocumentUri, selection: lastSelection, isSelection: lastWasSelection };
}

/**
 * Returns the best available editor and source text for Explain file or Explain selection.
 * Tries activeTextEditor first; when the panel has focus it is undefined, so falls back to
 * stored document/selection from visibleTextEditors.
 */
export function getEditorAndSource(
  mode: 'file' | 'selection'
): { source: string; isSelection: boolean } | null {
  const isSelectionMode = mode === 'selection';

  // Prefer active text editor (when code editor has focus)
  let editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId === 'python') {
    const selection = editor.selection;
    const source =
      isSelectionMode && !selection.isEmpty
        ? editor.document.getText(selection)
        : editor.document.getText();
    if (source.trim()) {
      setLastEditorContext(editor, isSelectionMode && !selection.isEmpty);
      return { source, isSelection: isSelectionMode && !selection.isEmpty };
    }
    if (!isSelectionMode) {
      setLastEditorContext(editor, false);
      return { source, isSelection: false };
    }
  }

  // Fall back to stored context (panel has focus so activeTextEditor is undefined)
  const stored = getLastEditorContext();
  if (!stored.uri) return null;

  const visible = vscode.window.visibleTextEditors.find(
    (e) => e.document.uri.toString() === stored.uri
  );
  if (!visible || visible.document.languageId !== 'python') return null;

  if (isSelectionMode && stored.selection) {
    const range = new vscode.Range(
      stored.selection.start.line,
      stored.selection.start.character,
      stored.selection.end.line,
      stored.selection.end.character
    );
    const source = visible.document.getText(range);
    if (source.trim()) {
      setLastEditorContext(visible, true);
      return { source, isSelection: true };
    }
  }

  const fullSource = visible.document.getText();
  if (fullSource.trim()) {
    setLastEditorContext(visible, false);
    return { source: fullSource, isSelection: false };
  }

  return null;
}
