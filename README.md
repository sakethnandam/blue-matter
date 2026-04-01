# Untitled – Your code is not yours until you understand it.

**Untitled** is a platform-level code intelligence system: a context-aware explanation engine that works across editors and IDEs. It indexes your codebase, caches explanations by structural signature, and calls AI only when needed—so you learn as you build, without repeated prompting.

## Architecture: One Brain, Many Hands

- **@untitled/core** — Platform-agnostic engine: indexing, caching, context building, AI orchestration.
- **VS Code / Cursor extension** — Thin adapter that uses the core; same logic can power Chrome, Replit, Colab, etc.

## Quick Start

### 1. Build

```bash
npm install
cd packages/core && npm run build
cd ../vscode-extension && npm install && npm run compile
```

### 2. Run the VS Code extension

- Open this repo in VS Code or Cursor.
- Press `F5` (Run > Start Debugging) to launch Extension Development Host.
- In the new window: open a project, select code, then **Cmd+Shift+E** (Mac) or **Ctrl+Shift+E** (Windows/Linux) to explain.

### 3. Configure API key (default: Open Router, free)

- **Open Router (default, free):** Set your API key via **Untitled: Set API Key** (stored in system keychain per PRD 6.2) or set `OPENROUTER_API_KEY` in your environment. Default model: `nvidia/nemotron-3-nano-30b-a3b:free`. You can change **Untitled: Open Router Model** to other free models (e.g. `meta-llama/llama-3.3-70b-instruct:free`, `stepfun/step-3.5-flash:free`).
- Code is anonymized before sending in standard privacy mode.

## Commands (VS Code)

| Command | Shortcut | Description |
|--------|----------|-------------|
| **Untitled: Explain Selected Code** | `Cmd+Shift+E` / `Ctrl+Shift+E` | Explain selected code in plain English |
| **Untitled: Explain Current File** | `Cmd+Shift+F` / `Ctrl+Shift+F` | Summarize the current file |
| **Untitled: Add Annotation** | `Cmd+Shift+N` / `Ctrl+Shift+N` | Add your own note for the selection |
| **Untitled: Search Annotations** | — | Search your annotations |
| **Untitled: Index Workspace** | — | Index workspace for context |
| **Untitled: Open Settings** | — | Open Untitled settings |

## Supported languages

Indexing and symbol extraction (for context-aware explanations) are supported for:

- **JavaScript / TypeScript** — `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs` (functions, classes, imports)
- **Python** — `.py` (functions, classes, imports)

Other file types can still be explained; they just won’t get repo-map context from the indexer.

## Features (from PRD)

- **Context-aware explanations** — Uses a lightweight index (files, symbols, imports) to build a compact “repo map” and explain code in context.
- **Persistent cache** — Explanations are keyed by content hash; cache hits avoid AI calls.
- **Personal annotations** — Add notes and tags to reinforce learning.
- **Privacy** — Standard mode anonymizes code before AI; strict mode is cache-only (no code sent).

## Project layout

```
untitled/
├── PRD.md                    # Product requirements
├── packages/
│   ├── core/                 # @untitled/core — indexer, cache, context, AI
│   └── vscode-extension/    # VS Code / Cursor thin adapter
└── README.md
```

## Development

- **Core:** `packages/core` — TypeScript, Node 18+. Build: `npm run build`.
- **Extension:** `packages/vscode-extension` — Depends on `@untitled/core` via workspace. Build core first, then `npm run compile`.

## License

Proprietary. See repository terms.
