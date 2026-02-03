/**
 * Explanation panel - Webview that shows AI explanation and user annotations
 */

import * as vscode from 'vscode';
import type { Explanation } from '@untitled/core';

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
        { enableScripts: true, retainContextWhenHidden: true }
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
    const textEscaped = escapeHtml(e.text);
    const summaryEscaped = escapeHtml(e.summary);
    const fileEscaped = escapeHtml(this.currentFilePath);
    this.panel.title = 'Untitled - Explanation';
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Untitled</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family), -apple-system, sans-serif;
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      margin: 0;
      line-height: 1.5;
    }
    h2 { font-size: 14px; margin: 0 0 8px 0; color: var(--vscode-textLink-foreground); }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 8px; }
    .badge-cache { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .badge-ai { background: #3b82f6; color: white; }
    .code-block { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: var(--vscode-editor-font-family); font-size: 12px; margin: 8px 0; white-space: pre-wrap; }
    .explanation { margin: 12px 0; }
    .file-path { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="file-path">${fileEscaped}</div>
  <span class="badge badge-${e.source === 'cache' ? 'cache' : 'ai'}">${e.source === 'cache' ? 'From cache' : 'AI explanation'}</span>
  <h2>Explanation</h2>
  <div class="explanation">${textEscaped.replace(/\n/g, '<br>')}</div>
  <h2>Code</h2>
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
