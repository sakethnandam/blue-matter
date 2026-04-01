/**
 * CodeLens provider: shows "Explain" button above the current selection.
 * Clicking it runs the same command as Cmd+Shift+E (untitled.explainCode).
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
      let editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== document) {
        editor = undefined;
        const notebookEditor = vscode.window.activeNotebookEditor;
        if (notebookEditor) {
          const cell = notebookEditor.notebook
            .getCells()
            .find((c) => c.document === document);
          if (cell) {
            const cellEditor = vscode.window.visibleTextEditors.find(
              (e) => e.document === document
            );
            editor = cellEditor;
          }
        }
      }
      if (!editor || editor.document !== document) {
        return [];
      }
      const sel = editor.selection;
      if (sel.isEmpty) {
        return [];
      }
      const text = document.getText(sel);
      if (!text.trim()) {
        return [];
      }
      // Place the lens above the first line of the selection; pass URI and range so the command does not rely on current selection (PRD 6: security).
      const range = new vscode.Range(sel.start.line, 0, sel.start.line, 0);
      const rangeArg = {
        start: { line: sel.start.line, character: sel.start.character },
        end: { line: sel.end.line, character: sel.end.character },
      };
      return [
        new vscode.CodeLens(range, {
          title: '$(book) Explain',
          command: 'untitled.explainCode',
          arguments: [document.uri.toString(), rangeArg],
        }),
      ];
    },
  };

  const selector = SUPPORTED_LANGUAGES.map((lang) => ({ language: lang }));
  const lensDisposable = vscode.languages.registerCodeLensProvider(
    selector,
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

  const notebookSelectionDisposable =
    vscode.window.onDidChangeNotebookEditorSelection(() => {
      fireExplainCodeLensChange();
    });

  return vscode.Disposable.from(
    lensDisposable,
    selectionDisposable,
    activeEditorDisposable,
    notebookSelectionDisposable
  );
}
