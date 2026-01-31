import * as vscode from 'vscode';

const selectionChangeEmitter = new vscode.EventEmitter<void>();

function fireExplainCodeLensChange(): void {
  selectionChangeEmitter.fire();
}

export function registerExplainCodeLensProvider(): vscode.Disposable {
  const provider: vscode.CodeLensProvider = {
    onDidChangeCodeLenses: selectionChangeEmitter.event,

    provideCodeLenses(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
      if (document.languageId !== 'python') {
        return [];
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== document) {
        return [];
      }
      const sel = editor.selection;
      if (sel.isEmpty) {
        return [];
      }
      // Place the "Explain" lens above the first line of the selection
      const range = new vscode.Range(sel.start.line, 0, sel.start.line, 0);
      return [
        new vscode.CodeLens(range, {
          title: '$(book) Explain',
          command: 'untitled.explainSelection',
          arguments: [],
        }),
      ];
    },
  };

  const lensDisposable = vscode.languages.registerCodeLensProvider(
    { language: 'python' },
    provider
  );

  const selectionDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.textEditor.document.languageId === 'python') {
      fireExplainCodeLensChange();
    }
  });

  return vscode.Disposable.from(lensDisposable, selectionDisposable);
}
