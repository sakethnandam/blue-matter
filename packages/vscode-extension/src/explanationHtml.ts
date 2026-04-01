/**
 * Markdown-to-safe-HTML pipeline for explanation panel (PRD 6.2: output sanitization).
 * Only e.text is passed through; file path and code snippet stay escaped in panel.
 */

import { marked } from 'marked';

/** Allowlist of tags allowed in explanation body after markdown parse (XSS mitigation). */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a',
]);

/** Schemes we allow for <a href> (strip javascript:, data:, etc.). */
const SAFE_LINK_SCHEMES = new Set(['https:', 'http:']);

/** Escape a string for safe use inside a double-quoted HTML attribute (XSS defense-in-depth). */
function escapeAttrValue(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

/**
 * Decode HTML entities in a string so we can validate the real value the browser will use.
 * Prevents bypasses like href="&#106;avascript:alert(1)" where the browser decodes to javascript:.
 * Repeated until fixed point to handle double-encoding (e.g. &#38;#106;avascript:).
 */
function decodeHtmlEntities(s: string): string {
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return s;
}

/**
 * Sanitize HTML produced by markdown parser: allowlist tags only; for <a> only allow safe href.
 * All other attributes (e.g. on*, style) are stripped to prevent XSS.
 * Href is decoded before protocol check so entity-encoded schemes cannot bypass (PRD 6.2).
 */
function sanitizeHtml(html: string): string {
  // Strip HTML comments first to prevent parser differential attacks
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const out = noComments.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?\/?>/g, (full, tagName) => {
    const name = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (full.startsWith('</')) return `</${name}>`;
    // Opening tag: allow only safe attributes per tag
    if (name === 'a') {
      // Match quoted ("...", '...') and unquoted (value until space or >) so unquoted href=javascript:... is validated
      const hrefMatch = full.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'|href\s*=\s*([^\s>]+)/i);
      let href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '').trim() : '';
      if (!href) href = '#';
      href = decodeHtmlEntities(href);
      try {
        // Parse without a base URL — relative URLs throw and fall through to '#',
        // preventing path traversal via ../... or protocol-relative //evil.com links.
        const url = new URL(href);
        if (!SAFE_LINK_SCHEMES.has(url.protocol)) href = '#';
      } catch {
        href = '#';
      }
      return `<a href="${escapeAttrValue(href)}">`;
    }
    return `<${name}>`;
  });
  return out;
}

/**
 * Convert explanation markdown to safe HTML for webview (parse + sanitize).
 * Used only for e.text; do not pass file path or code snippet.
 */
export function markdownToSafeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  const raw = marked.parse(text, {
    async: false,
    gfm: true,
    breaks: true,
  });
  const html = typeof raw === 'string' ? raw : '';
  return sanitizeHtml(html);
}
