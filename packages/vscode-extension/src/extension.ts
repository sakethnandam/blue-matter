/**
 * Untitled VS Code Extension - Thin adapter to @untitled/core
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { getPanel, disposePanel } from './panel';
import { getCore, promptForApiKey, hasStoredApiKey, clearStoredApiKey, shutdownCore } from './coreAdapter';
import { registerExplainCodeLensProvider } from './explainCodeLens';

/** Coerce to non-negative integer; supports numbers or numeric strings (CodeLens args can be serialized as strings). */
function toNonNegativeInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const i = Math.floor(n);
  return Number.isInteger(n) ? n : i;
}

/** Validates CodeLens range args (PRD 6: input validation). Accepts line/character as number or numeric string. */
function isValidRangeArg(
  r: unknown
): r is { start: { line: number; character: number }; end: { line: number; character: number } } {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  const start = o.start;
  const end = o.end;
  if (!start || typeof start !== 'object' || !end || typeof end !== 'object') return false;
  const sl = toNonNegativeInt((start as Record<string, unknown>).line);
  const sc = toNonNegativeInt((start as Record<string, unknown>).character);
  const el = toNonNegativeInt((end as Record<string, unknown>).line);
  const ec = toNonNegativeInt((end as Record<string, unknown>).character);
  if (sl === null || sc === null || el === null || ec === null) return false;
  if (sl > el || (sl === el && sc > ec)) return false;
  return true;
}

/** Parse range arg to integers (use after isValidRangeArg). CodeLens may pass numbers as strings. */
function rangeArgToRange(
  rangeArg: { start: { line: number; character: number }; end: { line: number; character: number } }
): vscode.Range {
  const startLine = Math.max(0, Math.floor(Number(rangeArg.start.line)));
  const startChar = Math.max(0, Math.floor(Number(rangeArg.start.character)));
  const endLine = Math.max(0, Math.floor(Number(rangeArg.end.line)));
  const endChar = Math.max(0, Math.floor(Number(rangeArg.end.character)));
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

/** Clamps range to document bounds; returns null if invalid. */
function clampRangeToDocument(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
  const lineCount = document.lineCount;
  if (lineCount === 0) return null;
  const startLine = Math.max(0, Math.min(range.start.line, lineCount - 1));
  const endLine = Math.max(0, Math.min(range.end.line, lineCount - 1));
  const startLineLength = document.lineAt(startLine).text.length;
  const endLineLength = document.lineAt(endLine).text.length;
  const startChar = Math.max(0, Math.min(range.start.character, startLineLength));
  const endChar = Math.max(0, Math.min(range.end.character, endLineLength));
  if (startLine > endLine || (startLine === endLine && startChar > endChar)) return null;
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

export function activate(context: vscode.ExtensionContext): void {
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
    vscode.commands.registerCommand(
      'untitled.explainCode',
      async (uriStringArg?: unknown, rangeArg?: unknown) => {
        let text: string;
        let filePath: string;
        let language: string;

        // CodeLens passes (uriString, rangeArg) as two separate parameters (VS Code API).
        if (uriStringArg != null && rangeArg != null) {
          const uriString = typeof uriStringArg === 'string' ? uriStringArg : String(uriStringArg);
          if (!uriString.trim()) {
            vscode.window.showWarningMessage('Untitled: Invalid document.');
            return;
          }
          const uri = vscode.Uri.parse(uriString);
          // Security: only allow file or untitled schemes (no http/https/git/etc.)
          const allowedSchemes = ['file', 'untitled'];
          if (!allowedSchemes.includes(uri.scheme)) {
            vscode.window.showWarningMessage('Untitled: Document is not in the workspace.');
            return;
          }
          const inWorkspace = vscode.workspace.getWorkspaceFolder(uri);
          // Untitled: getWorkspaceFolder often returns undefined; allow. File: allow; we verify path after open when getWorkspaceFolder was undefined (path fallback).
          if (!isValidRangeArg(rangeArg)) {
            vscode.window.showWarningMessage('Untitled: Invalid selection.');
            return;
          }
          try {
            const document = await vscode.workspace.openTextDocument(uri);
            // Security: for file scheme with workspace open, ensure path is under a workspace folder (fallback when getWorkspaceFolder failed)
            if (
              uri.scheme === 'file' &&
              vscode.workspace.workspaceFolders?.length &&
              !inWorkspace
            ) {
              const docPath = path.normalize(document.uri.fsPath);
              const underFolder = vscode.workspace.workspaceFolders.some((folder) => {
                const root = path.normalize(folder.uri.fsPath);
                return docPath === root || docPath.startsWith(root + path.sep);
              });
              if (!underFolder) {
                vscode.window.showWarningMessage('Untitled: Document is not in the workspace.');
                return;
              }
            }
            const range = clampRangeToDocument(document, rangeArgToRange(rangeArg));
            if (!range) {
              vscode.window.showWarningMessage('Untitled: Invalid selection.');
              return;
            }
            text = document.getText(range);
            filePath = document.uri.fsPath;
            language = document.languageId;
          } catch {
            vscode.window.showWarningMessage('Untitled: Could not open document.');
            return;
          }
        } else {
          let editor = vscode.window.activeTextEditor;
          if (!editor || editor.selection.isEmpty) {
            editor = vscode.window.visibleTextEditors.find((e) => !e.selection.isEmpty);
          }
          if (!editor) {
            vscode.window.showWarningMessage('Untitled: Open a file and select code to explain.');
            return;
          }
          const selection = editor.selection;
          text = editor.document.getText(selection);
          filePath = editor.document.uri.fsPath;
          language = editor.document.languageId;
        }

        if (!text.trim()) {
          vscode.window.showWarningMessage('Untitled: Select some code first, then run "Explain Selected Code".');
          return;
        }
        statusBar.text = '$(sync~spin) Untitled: Explaining...';
        try {
          const core = await getCore(context, workspaceRoot, storagePath, userId);
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
      }
    ),
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
    vscode.commands.registerCommand('untitled.showDashboard', () => {
      getPanel(context).reveal();
      getPanel(context).showDashboard();
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
    getCore(context, workspaceRoot, storagePath, userId)
      .then((core) => core.indexRepository(workspaceRoot))
      .then((result) => {
        statusBar.tooltip = `Untitled: ${result.filesIndexed} files indexed. Select code and Cmd+Shift+E to explain.`;
      })
      .catch(() => {});
  }
}

export async function deactivate(): Promise<void> {
  disposePanel();
  await shutdownCore();
}
