/**
 * CodeLens provider: shows "Explain" button above the current selection.
 * Clicking it runs the same command as Cmd+Shift+E (bluematter.explainCode).
 *
 * Supports regular files and Jupyter notebook cell documents
 * (scheme: vscode-notebook-cell). The selector includes both bare language
 * entries (for regular files) and scheme-qualified entries (for notebook cells)
 * so the provider fires reliably across VS Code versions.
 */

import * as vscode from 'vscode';

const selectionChangeEmitter = new vscode.EventEmitter<void>();

function fireExplainCodeLensChange(): void {
  selectionChangeEmitter.fire();
}

const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'python',
];

export function registerExplainCodeLensProvider(): vscode.Disposable {
  const provider: vscode.CodeLensProvider = {
    onDidChangeCodeLenses: selectionChangeEmitter.event,

    provideCodeLenses(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
      if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
        return [];
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor) return [];

      // Use URI equality as fallback for notebook cell documents where reference
      // equality (editor.document !== document) may not hold across VS Code versions.
      const sameDoc =
        editor.document === document ||
        editor.document.uri.toString() === document.uri.toString();
      if (!sameDoc) return [];

      const sel = editor.selection;
      if (sel.isEmpty) return [];

      const text = document.getText(sel);
      if (!text.trim()) return [];

      // Place the lens above the first line of the selection; pass URI and range
      // so the command does not rely on the current selection at click time (security).
      const range = new vscode.Range(sel.start.line, 0, sel.start.line, 0);
      const rangeArg = {
        start: { line: sel.start.line, character: sel.start.character },
        end: { line: sel.end.line, character: sel.end.character },
      };
      return [
        new vscode.CodeLens(range, {
          title: '$(book) Explain',
          command: 'bluematter.explainCode',
          arguments: [document.uri.toString(), rangeArg],
        }),
      ];
    },
  };

  // Register for both plain-language selectors (regular files) and
  // scheme-qualified selectors (notebook cell documents).
  const plainSelectors = SUPPORTED_LANGUAGES.map((lang) => ({ language: lang }));
  const notebookSelectors = SUPPORTED_LANGUAGES.map((lang) => ({
    scheme: 'vscode-notebook-cell',
    language: lang,
  }));

  const lensDisposable = vscode.languages.registerCodeLensProvider(
    [...plainSelectors, ...notebookSelectors],
    provider
  );

  const selectionDisposable = vscode.window.onDidChangeTextEditorSelection(
    (e) => {
      if (SUPPORTED_LANGUAGES.includes(e.textEditor.document.languageId)) {
        fireExplainCodeLensChange();
      }
    }
  );

  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor && SUPPORTED_LANGUAGES.includes(editor.document.languageId)) {
        fireExplainCodeLensChange();
      }
    }
  );

  return vscode.Disposable.from(
    lensDisposable,
    selectionDisposable,
    activeEditorDisposable
  );
}
