/**
 * Explanation panel - Webview that shows AI explanation and user annotations
 * PRD 6.2: output sanitization + CSP; only e.text is markdown-rendered; file path and code stay escaped.
 */

import * as vscode from 'vscode';
import type { Explanation } from '@blue-matter/core';
import { markdownToSafeHtml } from './explanationHtml';
import { DASHBOARD_MOTTO, getPanelStyles } from './theme';

let panelRef: ExplanationPanel | null = null;

/** Content Security Policy for all webview pages. No data: URIs, no scripts, no frames, no forms. */
const WEBVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' vscode-resource: https:; img-src 'self' vscode-resource: https:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";

export function getPanel(context: vscode.ExtensionContext): ExplanationPanel {
  if (!panelRef) {
    panelRef = new ExplanationPanel(context);
  }
  return panelRef;
}

/** Dispose the panel and clear the singleton reference. Call from deactivate(). */
export function disposePanel(): void {
  panelRef?.dispose();
  panelRef = null;
}

export class ExplanationPanel {
  private panel: vscode.WebviewPanel | null = null;
  private currentExplanation: Explanation | null = null;
  private currentCode = '';
  private currentFilePath = '';

  constructor(private readonly context: vscode.ExtensionContext) {}

  dispose(): void {
    this.panel?.dispose();
    this.panel = null;
  }

  reveal(): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'bluematterExplanations',
        'Blue Matter',
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          retainContextWhenHidden: true,
          enableCommandUris: true,
          localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'assets')],
        }
      );
      this.panel.onDidDispose(() => {
        this.panel = null;
        panelRef = null;
      });
    }
    this.panel.reveal();
    if (this.currentExplanation) {
      this.updateHtml();
    } else {
      this.showDashboard();
    }
  }

  /** Shows the dashboard view (motto and action buttons). */
  showDashboard(): void {
    if (!this.panel) return;
    const iconUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'blue-matter.png')
    );
    const headerHtml = buildHeaderHtml(iconUri.toString());
    const mottoEscaped = escapeHtml(DASHBOARD_MOTTO);
    this.panel.title = 'Blue Matter';
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${WEBVIEW_CSP.replace(/"/g, '&quot;')}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blue Matter</title>
  <style>${getPanelStyles()}</style>
</head>
<body>
  ${headerHtml}
  <div class="dashboard-body">
    <p class="dashboard-motto">${mottoEscaped}</p>
    <div class="dashboard-actions">
      <a href="command:bluematter.explainFile" class="btn-primary">EXPLAIN FILE</a>
      <a href="command:bluematter.explainCode" class="btn-primary">EXPLAIN SELECTION</a>
    </div>
  </div>
</body>
</html>`;
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
    const explanationBodyHtml = markdownToSafeHtml(typeof e.text === 'string' ? e.text : '');
    const iconUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'blue-matter.png')
    );
    this.panel.title = 'Blue Matter – Explanation';
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${WEBVIEW_CSP.replace(/"/g, '&quot;')}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blue Matter</title>
  <style>${getPanelStyles()}</style>
</head>
<body>
  ${buildHeaderHtml(iconUri.toString())}
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

/** Shared header fragment: brand link (logo + title) and settings gear link. */
function buildHeaderHtml(iconUri: string): string {
  const gearSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/></svg>';
  return `<div class="panel-header">
    <a href="command:bluematter.showDashboard" class="panel-header-brand"><img src="${escapeHtml(iconUri)}" alt="Blue Matter" /><span class="title">BLUE MATTER</span></a>
    <a href="command:bluematter.settings" class="panel-header-gear" aria-label="Settings">${gearSvg}</a>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
