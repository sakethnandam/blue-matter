import * as vscode from 'vscode';
import { extractConcepts, getLabels, type ParseResult } from '../analysis/conceptExtractor';
import { getConcept } from '../taxonomy/concepts';
import { fetchVideoForConcept, type YouTubeVideo } from '../youtube/youtubeClient';
import { fetchExplanation, type LLMExplanation } from '../llm/llmClient';
import { getYoutubeApiKey, getLlmApiKey, getLlmProvider, getOpenRouterModel } from '../config';
import { getEditorAndSource } from '../editorContext';

export class UntitledPanel {
  public static readonly viewType = 'untitled';
  private _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _extensionUri: vscode.Uri;

  public static createOrShow(extensionUri: vscode.Uri): UntitledPanel {
    // Always open beside the current editor so the panel lives side-by-side with the code
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      UntitledPanel.viewType,
      'untitled',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,
      }
    );

    return new UntitledPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): UntitledPanel {
    return new UntitledPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'explainFile':
            this.explainFile();
            break;
          case 'explainSelection':
            this.explainSelection();
            break;
          case 'openSettings':
            void vscode.commands.executeCommand('workbench.action.openSettings', 'untitled');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public explainFile(): void {
    this._panel.webview.postMessage({
      type: 'setState',
      state: 'loading',
      message: 'Analyzing file...',
    });

    const resolved = getEditorAndSource('file');
    if (!resolved) {
      this._panel.webview.postMessage({
        type: 'explanation',
        html: '',
        message: 'Open a Python file first, then click Explain file.',
      });
      this._panel.webview.postMessage({ type: 'setState', state: 'error', message: 'No file open.' });
      return;
    }

    const result = extractConcepts(resolved.source);
    void this._sendExplanation(result, resolved.source, false);
  }

  public explainSelection(): void {
    this._panel.webview.postMessage({
      type: 'setState',
      state: 'loading',
      message: 'Analyzing selection...',
    });

    const resolved = getEditorAndSource('selection');
    if (!resolved) {
      this._panel.webview.postMessage({
        type: 'setState',
        state: 'error',
        message: 'Open a Python file and select some code, then click Explain selection.',
      });
      return;
    }

    const result = extractConcepts(resolved.source);
    void this._sendExplanation(result, resolved.source, resolved.isSelection);
  }

  private async _sendExplanation(result: ParseResult, code: string, isSelection: boolean): Promise<void> {
    try {
      console.log('[untitled] _sendExplanation start', { concepts: result.concepts?.length, codeLength: code.length, isSelection });

      if (!result.success) {
        this._panel.webview.postMessage({
          type: 'setState',
          state: 'error',
          message: result.error || "Couldn't parse the code.",
        });
        return;
      }
      if (result.concepts.length === 0) {
        this._panel.webview.postMessage({
          type: 'explanation',
          html: '',
          message: 'No concepts detected in this ' + (isSelection ? 'selection' : 'file') + '.',
        });
        this._panel.webview.postMessage({
          type: 'setState',
          state: 'idle',
          message: 'No concepts detected.',
        });
        return;
      }

      const withLabels = getLabels(result.concepts);
      const youtubeApiKey = getYoutubeApiKey();
      const llmApiKey = getLlmApiKey();
      const llmProvider = getLlmProvider();
      console.log('[untitled] config', { hasYoutubeKey: !!youtubeApiKey, hasLlmKey: !!llmApiKey, llmProvider, conceptCount: withLabels.length });

      const conceptBlocks: Array<{
        id: string;
        label: string;
        video: YouTubeVideo | null;
        llm: LLMExplanation | null;
      }> = [];
      for (const c of withLabels) {
        let video: YouTubeVideo | null = null;
        if (youtubeApiKey) {
          try {
            console.log('[untitled] fetching video for concept', c.id);
            const def = getConcept(c.id);
            video = await fetchVideoForConcept(
              youtubeApiKey,
              c.id,
              c.label,
              def?.curatedVideoIds
            );
            console.log('[untitled] video result', c.id, video ? 'found' : 'null');
          } catch (err) {
            console.error('[untitled] YouTube fetch error for', c.id, err);
          }
        }
        let llm: LLMExplanation | null = null;
        if (llmApiKey) {
          try {
            console.log('[untitled] fetching LLM explanation for concept', c.id);
            llm = await fetchExplanation(
              llmProvider,
              llmApiKey,
              code,
              c.label,
              llmProvider === 'openrouter' ? getOpenRouterModel() : undefined
            );
            console.log('[untitled] LLM result', c.id, llm ? 'ok' : 'null');
          } catch (err) {
            console.error('[untitled] LLM fetch error for', c.id, err);
          }
        }
        conceptBlocks.push({ id: c.id, label: c.label, video, llm });
      }

      const intro =
        isSelection
          ? 'In this selection you\'re using: '
          : 'In this file you\'re using: ';
      const conceptList = withLabels.map((c) => c.label).join(', ');
      const html =
        '<p class="intro">' + escapeHtml(intro + conceptList) + '</p>' +
        conceptBlocks
          .map(
            (b) =>
              '<div class="concept-block" data-concept="' +
              escapeHtml(b.id) +
              '">' +
              '<h4 class="concept-heading">' +
              escapeHtml(b.label) +
              '</h4>' +
              (b.video
                ? buildVideoHtml(b.video)
                : '<p class="video-missing">Add YouTube API key in settings to see videos. <button class="link-button" data-action="openSettings">Open Settings</button></p>') +
              (b.llm
                ? '<p class="summary">' + escapeHtml(b.llm.summary) + '</p>'
                : '<p class="summary-placeholder">Add API key in settings for contextual summaries. <button class="link-button" data-action="openSettings">Open Settings</button></p>') +
              (b.llm && b.llm.alternatives.length > 0
                ? '<details class="see-alternatives"><summary>See alternatives</summary><ul>' +
                  b.llm.alternatives.map((a) => '<li>' + escapeHtml(a) + '</li>').join('') +
                  '</ul></details>'
                : '<details class="see-alternatives"><summary>See alternatives</summary><p>Add LLM API key in settings for dynamic alternatives. <button class="link-button" data-action="openSettings">Open Settings</button></p></details>') +
              '</div>'
          )
          .join('');
      console.log('[untitled] posting explanation', conceptBlocks.length, 'concepts');
      this._panel.webview.postMessage({
        type: 'explanation',
        html,
        message: intro + conceptList,
      });
      this._panel.webview.postMessage({
        type: 'setState',
        state: 'result',
        message: '',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[untitled] _sendExplanation error', err);
      this._panel.webview.postMessage({
        type: 'setState',
        state: 'error',
        message: 'Something went wrong: ' + message,
      });
    }
  }

  public postMessage(message: unknown): void {
    this._panel.webview.postMessage(message);
  }

  public dispose(): void {
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return getPanelHtmlTemplate();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVideoHtml(v: YouTubeVideo): string {
  const url = 'https://www.youtube.com/watch?v=' + v.videoId;
  const badge = v.wellExplained ? '<span class="well-explained">well-explained</span>' : '';
  return (
    '<div class="video-block">' +
    '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="video-link">' +
    '<img src="' + escapeHtml(v.thumbnailUrl) + '" alt="" class="video-thumb" />' +
    '<span class="video-watch">Watch</span>' +
    '</a>' +
    (badge ? '<div class="video-meta">' + badge + '</div>' : '') +
    '</div>'
  );
}

function getPanelHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; frame-src https://www.youtube.com;">
  <title>untitled</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 16px;
      font-family: "Andale Mono", "Courier New", monospace;
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      min-height: 100vh;
    }
    .brand {
      font-family: "Andale Mono", "Courier New", monospace;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 0.02em;
    }
    .tagline {
      font-size: 11px;
      opacity: 0.8;
      margin-bottom: 16px;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .header-actions button {
      font-family: "Andale Mono", "Courier New", monospace;
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
    }
    .header-actions button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    #content {
      min-height: 120px;
    }
    #content.idle, #content.loading {
      color: var(--vscode-descriptionForeground);
    }
    #content.error {
      color: var(--vscode-errorForeground);
    }
    #content.result .intro { margin-bottom: 12px; }
    #content.result .concept-block { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--vscode-widget-border); }
    #content.result .concept-block:last-child { border-bottom: none; }
    #content.result .concept-heading { margin: 0 0 8px 0; font-size: 14px; font-family: "Andale Mono", "Courier New", monospace; }
    #content.result .video-block { margin-bottom: 10px; }
    #content.result .video-link { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--vscode-textLink-foreground); }
    #content.result .video-thumb { max-width: 200px; height: auto; border-radius: 4px; }
    #content.result .video-meta { margin-top: 4px; font-size: 11px; }
    #content.result .well-explained { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 4px; }
    #content.result .video-missing, #content.result .summary-placeholder { font-size: 12px; color: var(--vscode-descriptionForeground); margin: 8px 0; }
    #content.result .summary { font-size: 12px; margin: 8px 0; line-height: 1.5; }
    #content.result .see-alternatives ul { margin: 8px 0 0 0; padding-left: 20px; }
    #content.result .see-alternatives { margin-top: 8px; font-size: 12px; }
    #content.result .see-alternatives summary { cursor: pointer; }
    .link-button { font-family: inherit; font-size: inherit; background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline; padding: 0; margin-left: 4px; }
    .link-button:hover { color: var(--vscode-textLink-activeForeground); }
  </style>
</head>
<body>
  <div class="brand">untitled</div>
  <div class="tagline">Your code is untitled until you own it.</div>
  <div class="header-actions">
    <button id="btn-explain-file">Explain file</button>
    <button id="btn-explain-selection">Explain selection</button>
  </div>
  <div id="content" class="idle">Open a Python file and click Explain file, or select code and click Explain selection.<br><br>Add API keys in Settings (search <strong>untitled</strong>) or in a <strong>.env</strong> file in your workspace root to get videos and summaries.</div>

  <script>
    const vscode = acquireVsCodeApi();
    const content = document.getElementById('content');
    const btnFile = document.getElementById('btn-explain-file');
    const btnSelection = document.getElementById('btn-explain-selection');

    btnFile.addEventListener('click', () => vscode.postMessage({ type: 'explainFile' }));
    btnSelection.addEventListener('click', () => vscode.postMessage({ type: 'explainSelection' }));

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'setState') {
        content.className = msg.state || 'idle';
        if (msg.state !== 'result' || (msg.message && msg.message.length > 0)) {
          content.textContent = msg.message || '';
        }
      }
      if (msg.type === 'explanation') {
        content.className = 'result';
        content.innerHTML = msg.html || msg.message || '';
      }
    });
    content.addEventListener('click', (e) => {
      const btn = e.target.closest('.link-button[data-action="openSettings"]');
      if (btn) vscode.postMessage({ type: 'openSettings' });
    });
  </script>
</body>
</html>`;
}
