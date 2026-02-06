/**
 * Base theme for Untitled UI. All colors and layout tokens live here.
 * Import this module wherever UI is built so styles stay consistent.
 * PRD 6.2: theme is static data only; no user/AI content. CSP and sanitization unchanged.
 */

export const theme = {
  colors: {
    background: '#282828',
    surface: '#3d3d3d',
    text: '#e0e0e0',
    textMuted: '#9e9e9e',
    accent: '#00AEEF',
    textOnAccent: '#fff',
  },
  typography: {
    fontFamily: 'var(--vscode-editor-font-family), monospace',
    fontSizeBase: '13px',
    fontSizeSmall: '11px',
    fontSizeCode: '12px',
    fontSizeHeading: '14px',
    lineHeightBody: '1.6',
    lineHeightExplanation: '1.65',
    letterSpacingTitle: '0.02em',
  },
  spacing: {
    paddingBody: '16px',
    gapHeader: '10px',
    marginBottomHeader: '12px',
    marginBottomFile: '8px',
    marginBottomBadge: '8px',
    marginSectionHeading: '16px 0 8px 0',
    marginExplanation: '12px 0',
    marginExplanationBlock: '8px 0',
    marginExplanationItem: '4px 0',
    marginHeading: '12px 0 6px 0',
    paddingInlineCode: '2px 6px',
    paddingCodeBlock: '12px',
    paddingList: '0 0 0 24px',
  },
  radius: {
    badge: '4px',
    code: '4px',
    codeBlock: '6px',
  },
} as const;

/**
 * Returns the full CSS for the explanation panel webview.
 * Uses only theme tokens; no hardcoded colors or sizes.
 */
export function getPanelStyles(): string {
  const t = theme;
  return `
    * { box-sizing: border-box; }
    body {
      font-family: ${t.typography.fontFamily};
      font-size: ${t.typography.fontSizeBase};
      line-height: ${t.typography.lineHeightBody};
      color: ${t.colors.text};
      background: ${t.colors.background};
      padding: ${t.spacing.paddingBody};
      margin: 0;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: ${t.spacing.gapHeader};
      margin-bottom: ${t.spacing.marginBottomHeader};
    }
    .panel-header img {
      width: 28px;
      height: 28px;
    }
    .panel-header .title {
      font-weight: bold;
      font-size: ${t.typography.fontSizeHeading};
      color: ${t.colors.textOnAccent};
      letter-spacing: ${t.typography.letterSpacingTitle};
    }
    .file-path {
      font-size: ${t.typography.fontSizeSmall};
      color: ${t.colors.textMuted};
      margin-bottom: ${t.spacing.marginBottomFile};
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: ${t.radius.badge};
      font-size: ${t.typography.fontSizeSmall};
      margin-bottom: ${t.spacing.marginBottomBadge};
    }
    .badge-cache {
      background: ${t.colors.surface};
      color: ${t.colors.text};
    }
    .badge-ai {
      background: ${t.colors.accent};
      color: ${t.colors.textOnAccent};
    }
    .section-heading {
      font-size: ${t.typography.fontSizeHeading};
      margin: ${t.spacing.marginSectionHeading};
      color: ${t.colors.accent};
      font-weight: 600;
    }
    .explanation {
      margin: ${t.spacing.marginExplanation};
      font-family: ${t.typography.fontFamily};
      line-height: ${t.typography.lineHeightExplanation};
      color: ${t.colors.text};
    }
    .explanation code {
      font-family: ${t.typography.fontFamily};
      background: ${t.colors.surface};
      padding: ${t.spacing.paddingInlineCode};
      border-radius: ${t.radius.code};
      font-size: ${t.typography.fontSizeCode};
    }
    .explanation pre {
      background: ${t.colors.surface};
      padding: ${t.spacing.paddingCodeBlock};
      border-radius: ${t.radius.codeBlock};
      overflow-x: auto;
      margin: ${t.spacing.marginExplanationBlock};
    }
    .explanation pre code {
      background: none;
      padding: 0;
    }
    .explanation ul,
    .explanation ol {
      margin: ${t.spacing.marginExplanationBlock};
      padding-left: ${t.spacing.paddingList};
    }
    .explanation li {
      margin: ${t.spacing.marginExplanationItem};
    }
    .explanation a {
      color: ${t.colors.accent};
    }
    .explanation h1,
    .explanation h2,
    .explanation h3 {
      color: ${t.colors.accent};
      margin: ${t.spacing.marginHeading};
      font-size: ${t.typography.fontSizeBase};
    }
    .code-block {
      background: ${t.colors.surface};
      padding: ${t.spacing.paddingCodeBlock};
      border-radius: ${t.radius.codeBlock};
      overflow-x: auto;
      font-family: ${t.typography.fontFamily};
      font-size: ${t.typography.fontSizeCode};
      margin: ${t.spacing.marginExplanationBlock};
      white-space: pre-wrap;
      color: ${t.colors.text};
    }
  `.trim();
}
