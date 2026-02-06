/**
 * Explanation panel - Webview that shows AI explanation and user annotations
 * PRD 6.2: output sanitization + CSP; only e.text is markdown-rendered; file path and code stay escaped.
 */

import * as vscode from 'vscode';
import type { Explanation } from '@untitled/core';
import { markdownToSafeHtml } from './explanationHtml';
import { getPanelStyles } from './theme';

let panelRef: ExplanationPanel | null = null;

export function getPanel(context: vscode.ExtensionContext): ExplanationPanel {
  if (!panelRef) {
    panelRef = new ExplanationPanel(context);
  }
  return panelRef;
}

export class ExplanationPanel {
  private panel: vscode.WebviewPanel | null = null;
  private currentExplanation: Explanation | null = null;
  private currentCode = '';
  private currentFilePath = '';

  constructor(private readonly context: vscode.ExtensionContext) {}

  reveal(): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'untitledExplanations',
        'Untitled - Explanations',
        vscode.ViewColumn.Beside,
        { enableScripts: false, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => {
        this.panel = null;
      });
    }
    this.panel.reveal();
    if (this.currentExplanation) {
      this.updateHtml();
    }
  }

  setExplanation(explanation: Explanation, code: string, filePath: string): void {
    this.currentExplanation = explanation;
    this.currentCode = code;
    this.currentFilePath = filePath;
    this.updateHtml();
    this.reveal();
  }

  private updateHtml(): void {
    if (!this.panel || !this.currentExplanation) return;
    const e = this.currentExplanation;
    const codeEscaped = escapeHtml(this.currentCode);
    const fileEscaped = escapeHtml(this.currentFilePath);
    const explanationBodyHtml = markdownToSafeHtml(e.text);
    const iconUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'untitled-icon.png')
    );
    const csp = "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' vscode-resource: https:; img-src 'self' data: vscode-resource: https:; script-src 'none';";
    this.panel.title = 'Untitled - Explanation';
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Untitled</title>
  <style>${getPanelStyles()}</style>
</head>
<body>
  <div class="panel-header">
    <img src="${iconUri.toString()}" alt="Untitled" />
    <span class="title">UNTITLED</span>
  </div>
  <div class="file-path">${fileEscaped}</div>
  <span class="badge badge-${e.source === 'cache' ? 'cache' : 'ai'}">${e.source === 'cache' ? 'From cache' : 'AI explanation'}</span>
  <h2 class="section-heading">Explanation</h2>
  <div class="explanation">${explanationBodyHtml}</div>
  <h2 class="section-heading">Code</h2>
  <pre class="code-block">${codeEscaped}</pre>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
