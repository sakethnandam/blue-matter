/**
 * Untitled VS Code Extension - Thin adapter to @untitled/core
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { getPanel } from './panel';
import { getCore, promptForApiKey, hasStoredApiKey, clearStoredApiKey } from './coreAdapter';
import { registerExplainCodeLensProvider } from './explainCodeLens';

const DEBUG_LOG = (loc: string, msg: string, data?: Record<string, unknown>) => {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f2bd9afe-b006-43ba-88a7-eec12bcad0f2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data ?? {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {});
  // #endregion
};

export function activate(context: vscode.ExtensionContext): void {
  // #region agent log
  DEBUG_LOG('extension.ts:activate', 'Untitled activate started', {});
  // #endregion
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) Untitled: Ready';
  statusBar.tooltip = 'Click to open Untitled panel. Select code and press Cmd+Shift+E to explain.';
  statusBar.command = 'untitled.openPanel';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();
  const storagePath = context.globalStorageUri.fsPath;
  const userId = 'vscode-' + (process.env.USER ?? 'default');

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.explainCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Untitled: Open a file and select code to explain.');
        return;
      }
      const selection = editor.selection;
      const text = editor.document.getText(selection);
      if (!text.trim()) {
        vscode.window.showWarningMessage('Untitled: Select some code first, then run "Explain Selected Code".');
        return;
      }
      statusBar.text = '$(sync~spin) Untitled: Explaining...';
      try {
        const core = await getCore(context, workspaceRoot, storagePath, userId);
        const filePath = editor.document.uri.fsPath;
        const language = editor.document.languageId;
        const explanation = await core.explainCode(text, {
          filePath,
          language: language === 'typescript' || language === 'javascript' ? 'javascript' : language,
        });
        const panel = getPanel(context);
        panel.reveal();
        panel.setExplanation(explanation, text, filePath);
        statusBar.text = '$(sparkle) Untitled: Ready';
      } catch (err) {
        statusBar.text = '$(sparkle) Untitled: Ready';
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Untitled: ${message}`);
      }
    }),
    registerExplainCodeLensProvider()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.explainFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Untitled: Open a file first.');
        return;
      }
      statusBar.text = '$(sync~spin) Untitled: Explaining file...';
      try {
        const core = await getCore(context, workspaceRoot, storagePath, userId);
        const filePath = editor.document.uri.fsPath;
        const explanation = await core.explainFile(filePath);
        const panel = getPanel(context);
        panel.reveal();
        panel.setExplanation(explanation, editor.document.getText(), filePath);
        statusBar.text = '$(sparkle) Untitled: Ready';
      } catch (err) {
        statusBar.text = '$(sparkle) Untitled: Ready';
        vscode.window.showErrorMessage(`Untitled: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.addAnnotation', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = editor.document.getText(editor.selection);
      if (!text.trim()) {
        vscode.window.showWarningMessage('Untitled: Select code first.');
        return;
      }
      const core = await getCore(context, workspaceRoot, storagePath, userId);
        const codeHash = core.getCodeHash(text);
      const note = await vscode.window.showInputBox({
        prompt: 'Add your note (explain this code in your own words)',
        placeHolder: 'e.g. This function validates email using regex...',
      });
      if (!note) return;
      core.createAnnotation(codeHash, note);
      vscode.window.showInformationMessage('Untitled: Annotation saved.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.searchAnnotations', async () => {
      const query = await vscode.window.showInputBox({ prompt: 'Search annotations' });
      if (!query) return;
      const core = await getCore(context, workspaceRoot, storagePath, userId);
      const results = core.searchAnnotations(query);
      if (results.length === 0) {
        vscode.window.showInformationMessage('No annotations found.');
        return;
      }
      const items = results.map((r) => ({
        label: r.text.slice(0, 60) + (r.text.length > 60 ? '...' : ''),
        description: r.tags.join(', '),
        detail: r.codeHash,
      }));
      const picked = await vscode.window.showQuickPick(items, { matchOnDescription: true });
      if (picked) vscode.window.showInformationMessage(picked.label);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.openPanel', () => {
      getPanel(context).reveal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.indexWorkspace', async () => {
      if (!workspaceRoot || !vscode.workspace.workspaceFolders?.length) {
        vscode.window.showWarningMessage('Untitled: Open a workspace first.');
        return;
      }
      statusBar.text = '$(sync~spin) Untitled: Indexing...';
      try {
        const core = await getCore(context, workspaceRoot, storagePath, userId);
        const result = await core.indexRepository(workspaceRoot);
        statusBar.text = '$(sparkle) Untitled: Ready';
        vscode.window.showInformationMessage(
          `Untitled: Indexed ${result.filesIndexed} files, ${result.symbolsExtracted} symbols in ${(result.duration / 1000).toFixed(1)}s.`
        );
      } catch (err) {
        statusBar.text = '$(sparkle) Untitled: Ready';
        vscode.window.showErrorMessage(`Untitled: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.settings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'untitled');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.setApiKey', async () => {
      const ok = await promptForApiKey(context);
      if (!ok) {
        vscode.window.showInformationMessage(
          "Untitled: You can set your API key later with 'Untitled: Set API Key' or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY."
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.clearStoredApiKey', async () => {
      await clearStoredApiKey(context);
      vscode.window.showInformationMessage('Untitled: Stored API key cleared from system keychain.');
    })
  );

  // First-time: if no API key (secrets + env), show a one-time prompt after a short delay
  const seenPrompt = context.globalState.get<boolean>('untitled.hasSeenApiKeyPrompt');
  hasStoredApiKey(context)
    .then((hasKey) => {
      if (!hasKey && !seenPrompt) {
        context.globalState.update('untitled.hasSeenApiKeyPrompt', true);
        setTimeout(() => {
          vscode.window
            .showInformationMessage(
              'Untitled: Add an API key to explain code (Cmd+Shift+E). Get a free key at openrouter.ai/keys.',
              'Set API Key',
              'Open Settings'
            )
            .then((choice) => {
              if (choice === 'Set API Key') void promptForApiKey(context);
              if (choice === 'Open Settings')
                vscode.commands.executeCommand('workbench.action.openSettings', 'untitled');
            });
        }, 2000);
      }
    })
    .catch(() => {
      // SecretStorage or env check failed; skip first-time prompt so activation continues
    });

  const config = vscode.workspace.getConfiguration('untitled');

  // Auto-index on startup if enabled
  if (config.get<boolean>('autoIndex') && workspaceRoot && vscode.workspace.workspaceFolders?.length) {
    // #region agent log
    DEBUG_LOG('extension.ts:autoIndex', 'Untitled about to getCore for auto-index', { workspaceRoot: workspaceRoot.slice(0, 50) });
    // #endregion
    getCore(context, workspaceRoot, storagePath, userId)
      .then((core) => {
        // #region agent log
        DEBUG_LOG('extension.ts:getCore-done', 'Untitled getCore resolved, calling indexRepository', {});
        // #endregion
        return core.indexRepository(workspaceRoot);
      })
      .then((result) => {
        statusBar.tooltip = `Untitled: ${result.filesIndexed} files indexed. Select code and Cmd+Shift+E to explain.`;
        // #region agent log
        DEBUG_LOG('extension.ts:index-done', 'Untitled indexRepository completed', { filesIndexed: result.filesIndexed });
        // #endregion
      })
      .catch(() => {});
  }
  // #region agent log
  DEBUG_LOG('extension.ts:activate', 'Untitled activate completed', {});
  // #endregion
}

export function deactivate(): void {
  // Core shutdown is handled by context disposal if we store it
}
