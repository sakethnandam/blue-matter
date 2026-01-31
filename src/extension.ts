import * as path from 'path';
import * as vscode from 'vscode';
import { config } from 'dotenv';
import { UntitledPanel } from './panel/panel';
import { registerExplainCodeLensProvider } from './codelens/explainCodeLens';

let panel: UntitledPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    config({ path: path.join(workspaceFolder.uri.fsPath, '.env') });
  }
  config({ path: path.join(context.extensionUri.fsPath, '.env') });

  context.subscriptions.push(
    vscode.commands.registerCommand('untitled.openPanel', () => {
      panel = UntitledPanel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand('untitled.explainFile', () => {
      panel = UntitledPanel.createOrShow(context.extensionUri);
      panel.explainFile();
    }),
    vscode.commands.registerCommand('untitled.explainSelection', () => {
      panel = UntitledPanel.createOrShow(context.extensionUri);
      panel.explainSelection();
    }),
    registerExplainCodeLensProvider()
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(UntitledPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        panel = UntitledPanel.revive(webviewPanel, context.extensionUri);
      },
    });
  }
}

export function deactivate(): void {}
