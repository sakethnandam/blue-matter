# @untitled/core

Platform-agnostic code intelligence engine for Untitled. Used by the VS Code extension and future adapters (Chrome, Replit, etc.).

## API (high level)

```ts
import { UntitledCore } from '@untitled/core';

const core = new UntitledCore({
  userId: 'user-1',
  storagePath: '/path/to/storage',
  workspaceRoot: '/path/to/repo',
  apiKey: process.env.OPENROUTER_API_KEY,
  aiProvider: 'openrouter',
  privacyMode: 'standard',
});

await core.initialize();

// Explain code (cache-first)
const explanation = await core.explainCode(selectedCode, {
  filePath: '/repo/src/utils.ts',
  language: 'javascript',
});

// Index workspace for context
await core.indexRepository('/path/to/repo');

// Annotations
core.createAnnotation(explanation.codeHash, 'My note', ['#regex']);
const notes = core.getAnnotations(explanation.codeHash);

await core.shutdown();
```

## Design

- **Indexer** — File discovery (fast-glob), generic parser (JS/TS/Python symbols), SQLite-backed symbol index.
- **Cache** — Explanation cache keyed by content hash (SHA-256 of normalized code).
- **Context** — Repo map + symbol definitions for the current file; built for AI prompts.
- **AI** — Anthropic provider; prompt builder with sanitization and strict “data only” instructions.
- **Security** — Input sanitization, path validation (no traversal), no execution of user code.

## Build

```bash
npm install
npm run build
```

Output: `dist/` (ESM).
