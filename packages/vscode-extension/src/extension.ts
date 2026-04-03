/**
 * Blue Matter VS Code Extension - Thin adapter to @blue-matter/core
 */

import * as vscode from 'vscode';
import { getPanel, disposePanel } from './panel';
import { getCore, promptForApiKey, hasStoredApiKey, clearStoredApiKey, shutdownCore } from './coreAdapter';
import { registerExplainCodeLensProvider } from './explainCodeLens';
import { resolveFromArgs, resolveFromActiveEditor, ALLOWED_SCHEMES } from './documentResolver';

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
function rangeArgToRangeObj(
  rangeArg: { start: { line: number; character: number }; end: { line: number; character: number } }
): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: {
      line: Math.max(0, Math.floor(Number(rangeArg.start.line))),
      character: Math.max(0, Math.floor(Number(rangeArg.start.character))),
    },
    end: {
      line: Math.max(0, Math.floor(Number(rangeArg.end.line))),
      character: Math.max(0, Math.floor(Number(rangeArg.end.character))),
    },
  };
}

/** Persist a UUID for this installation so all users get their own cache bucket (S5). */
function getOrCreateUserId(context: vscode.ExtensionContext): string {
  const key = 'blue-matter.userId';
  const stored = context.globalState.get<string>(key);
  if (stored) return stored;
  const { randomUUID } = require('crypto') as typeof import('crypto');
  const id = `bm-${randomUUID()}`;
  void context.globalState.update(key, id);
  return id;
}

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sparkle) Blue Matter: Ready';
  statusBar.tooltip = 'Click to open Blue Matter panel. Select code and press Cmd+Shift+E to explain.';
  statusBar.command = 'bluematter.openPanel';
  statusBar.show();
  context.subscriptions.push(statusBar);

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? require('os').homedir();
  const storagePath = context.globalStorageUri.fsPath;
  const userId = getOrCreateUserId(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'bluematter.explainCode',
      async (uriStringArg?: unknown, rangeArg?: unknown) => {
        let resolved: Awaited<ReturnType<typeof resolveFromArgs>> | ReturnType<typeof resolveFromActiveEditor>;

        // CodeLens path: passes (uriString, rangeArg) as separate parameters
        if (uriStringArg != null && rangeArg != null) {
          const uriString = typeof uriStringArg === 'string' ? uriStringArg : String(uriStringArg);
          if (!uriString.trim()) {
            vscode.window.showWarningMessage('Blue Matter: Invalid document.');
            return;
          }

          // Validate scheme before parsing further — allowed: file, untitled, vscode-notebook-cell
          const parsedUri = vscode.Uri.parse(uriString);
          if (!(ALLOWED_SCHEMES as readonly string[]).includes(parsedUri.scheme)) {
            vscode.window.showWarningMessage('Blue Matter: Document is not in the workspace.');
            return;
          }

          if (!isValidRangeArg(rangeArg)) {
            vscode.window.showWarningMessage('Blue Matter: Invalid selection.');
            return;
          }

          resolved = await resolveFromArgs(uriString, rangeArgToRangeObj(rangeArg));
        } else {
          // Keyboard shortcut path: use active editor (works for both files and notebook cells)
          resolved = resolveFromActiveEditor();
        }

        if (!resolved) {
          if (uriStringArg == null) {
            vscode.window.showWarningMessage('Blue Matter: Open a file and select code to explain.');
          }
          return;
        }

        const { code, language, filePath, notebookContext } = resolved;

        if (!code.trim()) {
          vscode.window.showWarningMessage('Blue Matter: Select some code first, then run "Explain Selected Code".');
          return;
        }

        statusBar.text = '$(sync~spin) Blue Matter: Explaining...';
        try {
          const core = await getCore(context, workspaceRoot, storagePath, userId);
          const explanation = await core.explainCode(code, {
            filePath,
            language: language === 'typescript' || language === 'javascript' ? 'javascript' : language,
            notebookContext,
          });
          const panel = getPanel(context);
          panel.reveal();
          panel.setExplanation(explanation, code, filePath);
          statusBar.text = '$(sparkle) Blue Matter: Ready';
        } catch (err) {
          statusBar.text = '$(sparkle) Blue Matter: Ready';
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Blue Matter: ${message}`);
        }
      }
    ),
    registerExplainCodeLensProvider()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.explainFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Blue Matter: Open a file first.');
        return;
      }
      statusBar.text = '$(sync~spin) Blue Matter: Explaining file...';
      try {
        const core = await getCore(context, workspaceRoot, storagePath, userId);
        const filePath = editor.document.uri.fsPath;
        const explanation = await core.explainFile(filePath);
        const panel = getPanel(context);
        panel.reveal();
        panel.setExplanation(explanation, editor.document.getText(), filePath);
        statusBar.text = '$(sparkle) Blue Matter: Ready';
      } catch (err) {
        statusBar.text = '$(sparkle) Blue Matter: Ready';
        vscode.window.showErrorMessage(`Blue Matter: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.addAnnotation', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = editor.document.getText(editor.selection);
      if (!text.trim()) {
        vscode.window.showWarningMessage('Blue Matter: Select code first.');
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
      vscode.window.showInformationMessage('Blue Matter: Annotation saved.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.searchAnnotations', async () => {
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
    vscode.commands.registerCommand('bluematter.openPanel', () => {
      getPanel(context).reveal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.showDashboard', () => {
      getPanel(context).reveal();
      getPanel(context).showDashboard();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.indexWorkspace', async () => {
      if (!workspaceRoot || !vscode.workspace.workspaceFolders?.length) {
        vscode.window.showWarningMessage('Blue Matter: Open a workspace first.');
        return;
      }
      statusBar.text = '$(sync~spin) Blue Matter: Indexing...';
      try {
        const core = await getCore(context, workspaceRoot, storagePath, userId);
        const result = await core.indexRepository(workspaceRoot);
        statusBar.text = '$(sparkle) Blue Matter: Ready';
        vscode.window.showInformationMessage(
          `Blue Matter: Indexed ${result.filesIndexed} files, ${result.symbolsExtracted} symbols in ${(result.duration / 1000).toFixed(1)}s.`
        );
      } catch (err) {
        statusBar.text = '$(sparkle) Blue Matter: Ready';
        vscode.window.showErrorMessage(`Blue Matter: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.settings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'bluematter');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.setApiKey', async () => {
      const ok = await promptForApiKey(context);
      if (!ok) {
        vscode.window.showInformationMessage(
          "Blue Matter: You can set your API key later with 'Blue Matter: Set API Key' or set the OPENROUTER_API_KEY environment variable."
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bluematter.clearStoredApiKey', async () => {
      await clearStoredApiKey(context);
      vscode.window.showInformationMessage('Blue Matter: Stored API key cleared from system keychain.');
    })
  );

  // First-time: if no API key (secrets + env), show a one-time prompt after a short delay
  const seenPrompt = context.globalState.get<boolean>('blue-matter.hasSeenApiKeyPrompt');
  hasStoredApiKey(context)
    .then((hasKey) => {
      if (!hasKey && !seenPrompt) {
        context.globalState.update('blue-matter.hasSeenApiKeyPrompt', true);
        setTimeout(() => {
          vscode.window
            .showInformationMessage(
              'Blue Matter: Add an API key to explain code (Cmd+Shift+E). Get a free key at openrouter.ai/keys.',
              'Set API Key',
              'Open Settings'
            )
            .then((choice) => {
              if (choice === 'Set API Key') void promptForApiKey(context);
              if (choice === 'Open Settings')
                vscode.commands.executeCommand('workbench.action.openSettings', 'bluematter');
            });
        }, 2000);
      }
    })
    .catch(() => {
      // SecretStorage or env check failed; skip first-time prompt so activation continues
    });

  const config = vscode.workspace.getConfiguration('bluematter');

  // Auto-index on startup if enabled
  if (config.get<boolean>('autoIndex') && workspaceRoot && vscode.workspace.workspaceFolders?.length) {
    getCore(context, workspaceRoot, storagePath, userId)
      .then((core) => core.indexRepository(workspaceRoot))
      .then((result) => {
        statusBar.tooltip = `Blue Matter: ${result.filesIndexed} files indexed. Select code and Cmd+Shift+E to explain.`;
      })
      .catch(() => {});
  }
}

export async function deactivate(): Promise<void> {
  disposePanel();
  await shutdownCore();
}
