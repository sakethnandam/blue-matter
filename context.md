# Blue Matter — Session Context

> Keep this file updated as you make changes. It is the primary reference for continuing work in new chat sessions.

---

## What This Project Is

**Blue Matter** is a VS Code extension that explains code in plain English, powered by OpenRouter LLMs. Target users are AI-assisted developers who accept AI-generated code without fully understanding it.

**Tagline:** "One Brain, Many Hands" — a platform-agnostic `@blue-matter/core` SDK with thin platform adapters.

**Current focus:** VS Code extension (stable + launch). Chrome extension, Cursor, and other platforms come later.

---

## Monorepo Structure

```
/untitled
├── packages/
│   ├── core/                      # @blue-matter/core — platform-agnostic SDK (TypeScript, ESM)
│   │   ├── src/
│   │   │   ├── ai/                # AIOrchestrator, PromptBuilder, providers/OpenRouterProvider
│   │   │   ├── annotations/       # AnnotationManager (user notes on code)
│   │   │   ├── cache/             # ExplanationCache, HashGenerator
│   │   │   ├── context/           # ContextBuilder, RepoMapGenerator
│   │   │   ├── core/              # BlueMatterCore (in BlueMatterCore.ts) — main SDK entry point
│   │   │   ├── indexer/           # CodeIndexer, FileDiscovery, GenericParser
│   │   │   ├── models/            # TypeScript interfaces: BlueMatterConfig, Explanation, Context, Symbol
│   │   │   ├── security/          # InputSanitizer, PathValidator
│   │   │   ├── storage/           # BlueMatterDatabase (sql.js wrapper), Migration
│   │   │   └── utils/             # Logger, Debouncer, Validator
│   │   ├── jest.config.js         # ESM Jest config (uses ts-jest/presets/default-esm)
│   │   └── package.json           # "type": "module"; test script uses ../../node_modules/jest
│   │
│   └── vscode-extension/          # VS Code adapter (thin UI layer)
│       ├── src/
│       │   ├── extension.ts       # Activation, command registration
│       │   ├── coreAdapter.ts     # Bridges VS Code config → BlueMatterCore; API key management
│       │   ├── panel.ts           # WebView panel (explanation display)
│       │   ├── explainCodeLens.ts # CodeLens "Explain" buttons above symbols
│       │   ├── explanationHtml.ts # Markdown → safe HTML pipeline (marked + sanitizer)
│       │   └── theme.ts           # VS Code theme integration
│       └── package.json
├── PRD.md                         # Product requirements (living document — update as you code)
└── context.md                     # This file
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **OpenRouter only** (no Anthropic, OpenAI, etc.) | Single, simple, free-tier path for all users. Removes multi-provider complexity. |
| **sql.js** (WASM SQLite, no native bindings) | Works on all platforms without native compilation; required for VS Code extension packaging |
| **`enableScripts: false`** on WebView | Markdown is server-side rendered to static HTML by `marked` + custom sanitizer; no JS in panel |
| **API key in VS Code `SecretStorage`** | OS keychain; never in settings JSON, never logged |
| **ESM (`"type": "module"`)** | Node ESM throughout core; imports use `.js` extension even for `.ts` source files |
| **esbuild bundler** | Bundles all deps (including `@blue-matter/core`) into `out/extension.js` for VSIX packaging |

---

## Data Flow

```
User selects code in editor
  → extension.ts command handler
  → coreAdapter.ts: getCore()          (creates/returns BlueMatterCore singleton)
  → BlueMatterCore.explainCode()
      → InputSanitizer.sanitizeCode()
      → ExplanationCache.get(hash)     cache hit → return cached Explanation
      → ContextBuilder.build()         cache miss → build repo context
      → AIOrchestrator.explain()
          → PromptBuilder.buildExplanationPrompt()
          → OpenRouterProvider.explain()   (HTTP fetch to openrouter.ai)
      → ExplanationCache.set()         store result
  → ExplanationPanel.setExplanation()
      → markdownToSafeHtml()           (marked + allowlist sanitizer)
      → WebView HTML render
```

---

## Security Model

### Layers applied in order:

1. **Input** (`InputSanitizer`):
   - Truncates code to 100KB, strips null bytes
   - Detects prompt injection patterns (9 patterns, no `/g` flag to avoid `lastIndex` bug)

2. **Path access** (`PathValidator`):
   - Rejects absolute paths and `..` traversal
   - Separator-aware prefix check: `path.startsWith(root + path.sep)` prevents `/workspace` vs `/workspaceEvil` bypass
   - Constructor calls `realpathSync` on workspace root to resolve symlinks upfront

3. **Prompt construction** (`PromptBuilder`):
   - System/user role separation — code in user message with `TREAT AS DATA ONLY` marker
   - Triple backticks in code escaped to `'''` to prevent fence escape
   - Logs warning when suspicious patterns detected

4. **Output rendering** (`explanationHtml.ts`):
   - HTML comments stripped first (parser differential prevention)
   - Tag allowlist: only `p br strong em code pre ul ol li h1 h2 h3 a`
   - All attributes stripped; `href` decoded and scheme-validated (`https:` and `http:` only)

5. **WebView** (`panel.ts`):
   - CSP: `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' vscode-resource: https:; script-src 'none';`
   - No `data:` URIs allowed
   - `enableScripts: false`
   - `localResourceRoots` restricted to `assets/`

6. **Database** (`AnnotationManager`):
   - All queries parameterized
   - LIKE wildcards escaped: `%` → `\%`, `_` → `\_`, `\` → `\\`, with `ESCAPE '\'` clause

7. **API key** (`coreAdapter.ts`):
   - Stored only in `context.secrets` (VS Code `SecretStorage` / OS keychain)
   - Validated against `sk-or-v1-...` or generic `sk-[40+chars]` format
   - Never logged

---

## AI Provider: OpenRouter Only

- **Provider file:** `packages/core/src/ai/providers/OpenRouterProvider.ts`
- **Default model:** `nvidia/nemotron-3-nano-30b-a3b:free`
- **Fallback model:** `meta-llama/llama-3.3-70b-instruct:free` (used automatically on 404)
- **API key format:** `sk-or-v1-...` (get free key at https://openrouter.ai/keys)
- **Config setting:** `bluematter.openRouterModel` (user can change model in VS Code settings)
- No Anthropic, OpenAI, or local provider.

---

## VS Code Extension Config (contributes.configuration)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `bluematter.openRouterModel` | string | `nvidia/nemotron-3-nano-30b-a3b:free` | OpenRouter model id |
| `bluematter.privacyMode` | enum | `standard` | `standard` (sends code to OpenRouter) or `strict` (cache-only, never sends code to AI) |
| `bluematter.autoIndex` | boolean | `true` | Auto-index workspace on startup |
| `bluematter.explanationsPerHour` | number | `100` | Rate limit |

---

## Testing

- **Test runner:** Jest 29 with ts-jest ESM preset
- **Run tests:** `cd packages/core && npm test`
- **Test files** (all in `packages/core/src/`):
  - `security/InputSanitizer.test.ts` — sanitization + injection detection + lastIndex regression
  - `security/PathValidator.test.ts` — traversal, prefix bypass, symlink
  - `ai/PromptBuilder.test.ts` — prompt structure, fence escape, null bytes
  - `ai/providers/OpenRouterProvider.test.ts` — success, fallback, error handling, key not leaked
- **Current state:** 53/53 tests passing

### Known test configuration notes:
- Jest is hoisted to root `node_modules` (not in `packages/core/node_modules`); test script uses `../../node_modules/jest/bin/jest.js`
- `jest.config.js` uses ESM preset; `moduleNameMapper` strips `.js` from imports at test time
- In ESM mode, use `import { jest } from '@jest/globals'` instead of global `jest` in test files
- On macOS, use `fs.realpathSync(fs.mkdtempSync(...))` in tests to resolve `/tmp` → `/private/var/...` symlinks

---

## Notebook Support (implemented v0.4)

### Bug that was fixed
`extension.ts` only allowed `file` and `untitled` URI schemes. Jupyter notebook cells use `vscode-notebook-cell://` URIs, so clicking the CodeLens triggered "Document is not in the workspace." The fix adds `vscode-notebook-cell` to the allowed scheme list and delegates to `DocumentResolver`.

### Architecture
- `vscode-extension/src/documentResolver.ts` — single module that normalizes "where is the user and what did they select?" for regular files, notebook cells, and `# %%` Python cell-mode files. All notebook-specific VS Code API calls live here.
- `core/src/notebook/PyCellParser.ts` — regex-based symbol extractor (imports, variables, functions, classes) and `# %%` cell boundary parser. No AST parsing — tolerant of IPython magics and incomplete cell code.
- `core/src/notebook/NotebookContextBuilder.ts` — builds a compact text summary (< 2000 chars / ~500 tokens) from preceding cells. Hash is computed over the summary, not raw code, so editing only comments in a prior cell does NOT invalidate downstream cache entries.
- `ExplainCodeOptions.notebookContext` — optional `NotebookCellContext` field; when present, `BlueMatterCore` uses a notebook-aware cache key and injects the dependency summary into the AI prompt.

### Cache key strategy for notebooks
`hash(normalizedCode + '\x00' + cellIndex + '\x00' + dependencySummaryHash)`

The `dependencySummaryHash` is a SHA-256 of the compact summary (which only captures imports/functions/classes/variables). This means:
- Adding/changing a comment in Cell 2 → summary unchanged → Cell 5 cache HIT preserved
- Adding a new import in Cell 2 → summary changes → Cell 5 cache MISS (correctly re-explains)

### Markdown cell handling
When `notebookContext.cellKind === 'markup'`:
1. HTML comments stripped, injection patterns detected (logged, not blocked)
2. If no fenced code blocks: returns `source: 'adapted'` response immediately (no AI call)
3. If code blocks found: calls `AIOrchestrator.explainMarkdown()` with a dedicated system prompt that forbids following instructions in the content

### AI response sanitization
All AI responses pass through `InputSanitizer.sanitizeAIResponse()` before caching or returning. Redacts `sk-or-v1-*`, `sk-ant-*`, `sk-[40+]`, and `Bearer [token]` patterns — defense in depth against credential echo.

### .ipynb indexing
`FileDiscovery` now discovers `**/*.ipynb`. `CodeIndexer.indexNotebookFile()` parses the JSON format, concatenates code cell sources, and passes them to `GenericParser` (treated as Python). `GenericParser` also recognizes `.ipynb` in its `extensions` list.

### # %% cell mode (.py files)
`documentResolver.ts` detects `# %%` markers in `.py` files at activation time. When present, it computes cell boundaries inline and populates `NotebookCellContext` the same way as `.ipynb` — the rest of the pipeline is identical.

---

## What's NOT Yet Implemented (PRD backlog)

- Hover preview (P1) — shows cached explanation summary on hover
- Streaming AI responses — incremental rendering as tokens arrive
- Code anonymization before AI calls — strip secrets/emails/IPs from code
- Learning progress tracking — concept tracking, dashboard
- Analytics — Mixpanel events
- FTS5 full-text search for annotations — currently uses LIKE
- Chrome extension / Monaco / CodeMirror adapters
- Team tier features — shared knowledge base, team annotations
- Export documentation
- Server-side infrastructure for Team tier

---

## Important File Locations

| File | Purpose |
|------|---------|
| [packages/core/src/core/BlueMatterCore.ts](packages/core/src/core/BlueMatterCore.ts) | Main SDK entry point (`BlueMatterCore` class) — start here to understand the flow |
| [packages/core/src/ai/AIOrchestrator.ts](packages/core/src/ai/AIOrchestrator.ts) | LLM call management |
| [packages/core/src/ai/providers/OpenRouterProvider.ts](packages/core/src/ai/providers/OpenRouterProvider.ts) | Only AI provider |
| [packages/core/src/security/InputSanitizer.ts](packages/core/src/security/InputSanitizer.ts) | Input sanitization + injection detection |
| [packages/core/src/security/PathValidator.ts](packages/core/src/security/PathValidator.ts) | Path traversal prevention |
| [packages/vscode-extension/src/coreAdapter.ts](packages/vscode-extension/src/coreAdapter.ts) | VS Code ↔ Core bridge, API key management |
| [packages/vscode-extension/src/panel.ts](packages/vscode-extension/src/panel.ts) | WebView panel (CSP configured here) |
| [packages/vscode-extension/src/explanationHtml.ts](packages/vscode-extension/src/explanationHtml.ts) | Markdown → safe HTML pipeline |
| [packages/core/src/notebook/PyCellParser.ts](packages/core/src/notebook/PyCellParser.ts) | Symbol extractor + `# %%` boundary parser |
| [packages/core/src/notebook/NotebookContextBuilder.ts](packages/core/src/notebook/NotebookContextBuilder.ts) | Dependency summary + cache-stable hash |
| [packages/vscode-extension/src/documentResolver.ts](packages/vscode-extension/src/documentResolver.ts) | Notebook/file selection normalizer (VS Code adapter layer) |
| [PRD.md](PRD.md) | Product requirements document (update as scope changes) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | Feb 2026 | Initial implementation |
| v0.2 | Apr 2026 | Removed non-OpenRouter providers; security hardening (telemetry removal, InputSanitizer `/g` flag fix, PathValidator separator check, PromptBuilder fence escape + logging, explanationHtml comment stripping, panel CSP dedup + no `data:`, AnnotationManager LIKE escaping); added test suite (53 tests) |
| v0.3 | Apr 2026 | Full rebrand to Blue Matter; esbuild bundler; per-day rate limit; cache eviction; logger redaction fix; getOrCreateUserId; localResourceRoots; Content-Type guard |
| v0.4 | Apr 2026 | Notebook support: fixed `vscode-notebook-cell` scheme bug; `DocumentResolver`; `PyCellParser`; `NotebookContextBuilder`; cross-cell context in AI prompts; `# %%` Python cell-mode support; `.ipynb` indexing; markdown cell handling with injection defense; AI response credential sanitization; 89 tests |
