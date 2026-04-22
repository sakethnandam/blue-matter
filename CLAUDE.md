# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Security Requirement — Mandatory for Every Change

**Before marking any task complete, run a security audit on all new and modified code.**

Check every changed file for:

1. **Unsanitized input entering AI prompts** — all user-derived text must go through `InputSanitizer` before being interpolated into a prompt. The notebook summary, repo map, and code all have distinct sanitizer methods; use the right one for each path. Adding a new field to a prompt? Sanitize it first.
2. **Missing size caps** — user-controlled strings fed to parsers, stored, or logged must be truncated. The ceiling is `100_000` chars for code and `10_000` for annotations/summaries (matching `InputSanitizer`).
3. **Null-byte stripping** — any string from an external source (VS Code API, file system, AI response) must have null bytes removed before use.
4. **Regex `/g` flag on shared objects** — never add `/g` to a regex that is a class-level or module-level constant and then call `.test()` or `.exec()` on it in a loop or across calls. `lastIndex` state causes false negatives. See `InputSanitizer.SUSPICIOUS_PATTERNS` for the canonical example of the correct pattern.
5. **Path traversal** — any file path from user input must go through `PathValidator.validatePath()` before any file I/O.
6. **New prompt interpolations** — if you add `${someVar}` to a prompt string, that var must be sanitized. Grep for bare `${` in `PromptBuilder.ts` after any change.

If you find a vulnerability: fix it in the same commit as the feature. Do not defer security fixes.

## Commands

```bash
# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Core package (most work happens here)
cd packages/core
npm run build       # TypeScript compile to dist/
npm run test        # Jest 29 with ESM preset (98 tests)
npm test -- --testPathPattern="InputSanitizer"  # Run a single test file

# VS Code extension
cd packages/vscode-extension
npm run compile     # TypeScript type-check only (no emit)
npm run bundle      # esbuild bundle to out/extension.js
npm run watch       # Watch mode for development
npm run package     # Build VSIX (requires vsce)
```

No linter is configured. TypeScript strict mode is on — `tsconfig.base.json` uses ES2022 targets.

## Architecture

Monorepo with two packages: a platform-agnostic SDK (`@blue-matter/core`) and a thin VS Code adapter that imports it via npm workspace.

```
packages/
  core/              # @blue-matter/core — indexer, cache, AI orchestrator, DB
  vscode-extension/  # VS Code adapter — UI, commands, WebView panel
```

**Data flow (code explanation):**
1. User selects code in VS Code → `extension.ts` command handler (Cmd+Shift+E)
2. `coreAdapter.ts` lazily creates a `BlueMatterCore` singleton, fetching the API key from VS Code `SecretStorage`
3. `BlueMatterCore.explainCode()` runs:
   - `InputSanitizer` → sanitize input
   - `ExplanationCache` → check hash (SHA-256) for cache hit
   - If miss: `ContextBuilder` builds a repo map, `AIOrchestrator` calls `OpenRouterProvider`, result is cached
4. `panel.ts` renders the explanation via `explanationHtml.ts` (markdown → allowlisted HTML, no JS in WebView)

## Key Files

| File | Role |
|------|------|
| `core/src/core/BlueMatterCore.ts` | Main SDK entry point (`BlueMatterCore` class); orchestrates all subsystems |
| `core/src/ai/AIOrchestrator.ts` | AI calls, rate limiting (sliding-window 100/hr + 1000/day) |
| `core/src/ai/providers/OpenRouterProvider.ts` | Only AI provider; default model + fallback |
| `core/src/ai/PromptBuilder.ts` | Prompt construction with injection defenses |
| `core/src/security/InputSanitizer.ts` | Truncate to 100KB, strip null bytes, detect 9 injection patterns |
| `core/src/security/PathValidator.ts` | Traversal prevention, symlink-safe prefix check |
| `core/src/cache/ExplanationCache.ts` | Content-addressed cache keyed by SHA-256 |
| `core/src/storage/Database.ts` | SQLite via sql.js (WASM, no native bindings) |
| `core/src/notebook/PyCellParser.ts` | AST-based symbol extractor for Python cells using `@lezer/python`; `# %%` boundary parser |
| `core/src/notebook/NotebookContextBuilder.ts` | Builds compact dependency summary from preceding cells; produces cache-stable hash |
| `vscode-extension/src/extension.ts` | Activation, 10 command registrations, status bar |
| `vscode-extension/src/documentResolver.ts` | Normalizes file vs. notebook cell selection; builds `NotebookCellContext` for VS Code |
| `vscode-extension/src/coreAdapter.ts` | VS Code ↔ BlueMatterCore bridge; API key via SecretStorage |
| `vscode-extension/src/explanationHtml.ts` | Markdown → safe HTML; tag/attr allowlist + URL validation |

## AI Provider

OpenRouter is the **only** provider. The extension was simplified to remove Anthropic/OpenAI adapters.

- Default model: `nvidia/nemotron-3-nano-30b-a3b:free`
- Fallback (on 404): `meta-llama/llama-3.3-70b-instruct:free`
- API key: stored in VS Code `SecretStorage` (OS keychain), never in settings JSON or logs
- Key format validation: `sk-or-v1-*` or generic `sk-[40+chars]`

## Security Model

Seven defense layers — all must be maintained when touching AI or file I/O:

1. **Input sanitization** — `InputSanitizer.sanitizeCode()` before any AI call
2. **Path validation** — `PathValidator.validatePath()` before any file read; uses `realpathSync` to resolve workspace root
3. **Prompt construction** — code wrapped in "DATA ONLY" delimiters, backticks escaped to `'''`, injection patterns rejected
4. **Output rendering** — tag allowlist (`p br strong em code pre ul ol li h1 h2 h3 a`), URL scheme validation (https/http only), HTML comments stripped
5. **WebView** — `enableScripts: false`, tight CSP, no `data:` URIs, `localResourceRoots` restricted to `assets/`
6. **Database** — all queries parameterized; LIKE wildcards escaped in annotation search
7. **Rate limiting** — sliding-window enforced in `AIOrchestrator` (per-hour and per-day)

**Injection detection**: `InputSanitizer` checks 9 regex patterns without the `/g` flag — this is intentional (avoids `lastIndex` stateful bug; tracked in test suite).

## Storage

`sql.js` (WASM SQLite) is used for all persistence. It runs in-memory and syncs to disk on `Database.close()`. This means:
- No native compile required (cross-platform)
- Database ops must complete before process exit or data is lost
- Path: `{storagePath}/blue-matter.db`

## Testing

Tests live in `packages/core/src/**/*.test.ts`. Coverage focuses on security-critical paths:

- `security/InputSanitizer.test.ts` — includes `/g` flag regression test
- `security/PathValidator.test.ts` — traversal, symlink, prefix bypass
- `ai/PromptBuilder.test.ts` — injection defense, fence escaping
- `ai/providers/OpenRouterProvider.test.ts` — success, fallback, API key not leaked in errors
- `notebook/PyCellParser.test.ts` — symbol extraction, `# %%` boundary parsing, cell-at-line lookup
- `notebook/NotebookContextBuilder.test.ts` — summary content, hash stability (comment changes must not change hash)

All 98 tests must pass before merging. Run with `cd packages/core && npm test`.

## ESM Notes

The core package uses ESM throughout. Import paths in source files use `.js` extensions (e.g., `import { Foo } from './Foo.js'`). Jest uses `ts-jest` with the ESM preset. Jest is hoisted to root `node_modules`.

## Context Files

- `context.md` — technical decisions, security rationale, test notes, backlog (read this before starting any session)
- `PRD.md` — product requirements and vision (living document)
