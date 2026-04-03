# Blue Matter — Pre-Publish Remediation & Rebranding Plan

Generated from the security audit and publish-readiness review.
All findings reference the audit report produced in this session.

---

## How to use this file

Work through milestones in order. Milestone 1 (rebranding) unblocks everything downstream.
Check off each task as completed. Do not skip Milestone 2 — those are hard publish blockers.

---

## Milestone 1 — Rebranding: "Untitled" → "Blue Matter"

Complete this first. Every subsequent task assumes the new name is in place.

- [ ] **Rename the icon file**
  - `packages/vscode-extension/assets/untitled-icon.png` → `assets/blue-matter.png`
  - Update reference in `packages/vscode-extension/package.json:7`
    ```
    "icon": "assets/blue-matter.png"
    ```

- [ ] **Update `packages/vscode-extension/package.json` identity fields**
  ```json
  "name": "blue-matter",
  "displayName": "Blue Matter for VS Code",
  "description": "Context-aware AI explanations for any code you select. Understands your repo, caches results, and explains in plain English.",
  "publisher": "blue-matter",
  ```
  > Marketplace publisher ID: try `blue-matter` first. If hyphens are rejected, use `bluematter`.
  > This ID is permanent — verify availability at marketplace.visualstudio.com/manage before committing.

- [ ] **Update `package.json` repository URL**
  ```json
  "repository": {
    "type": "git",
    "url": "https://github.com/sakethnandam/blue-matter"
  }
  ```
  > Rename the GitHub repo to `blue-matter` before publishing (Settings → Repository name).

- [ ] **Update `OpenRouterProvider.ts:70` HTTP-Referer**
  - File: `packages/core/src/ai/providers/OpenRouterProvider.ts`
  - Change:
    ```
    'HTTP-Referer': 'https://github.com/untitled'
    ```
    to:
    ```
    'HTTP-Referer': 'https://github.com/sakethnandam/blue-matter'
    ```

- [ ] **Update `extension.ts` UNTITLED_* constant and all user-facing strings**
  - File: `packages/vscode-extension/src/coreAdapter.ts:11`
    ```
    export const UNTITLED_API_KEY_SECRET = 'blue-matter-api-key';
    ```
    > Changing the secret key name will invalidate any previously stored keys. That is acceptable for a v0.1 first publish.
  - File: `packages/vscode-extension/src/extension.ts` — replace all visible "Untitled:" prefixes in `showInformationMessage`, `showWarningMessage`, `showErrorMessage`, and `statusBar.text` calls with "Blue Matter:".
  - File: `packages/vscode-extension/src/panel.ts:71` — update `this.panel.title` from `'Untitled'` / `'Untitled - Explanation'` to `'Blue Matter'` / `'Blue Matter – Explanation'`.
  - File: `packages/vscode-extension/src/theme.ts` — update any display strings referencing "Untitled".

- [ ] **Update all `contributes.commands` titles in `package.json`**
  - Change every `"title": "Untitled: …"` to `"title": "Blue Matter: …"` for all 10 commands.

- [ ] **Update command IDs throughout** (package.json → extension.ts → panel.ts → explainCodeLens.ts)
  - Rename `untitled.*` command IDs to `bluematter.*` in:
    - `packages/vscode-extension/package.json` (contributes.commands, menus, keybindings)
    - `packages/vscode-extension/src/extension.ts` (all `registerCommand` calls)
    - `packages/vscode-extension/src/panel.ts` (all `command:untitled.*` hrefs in dashboard HTML)
    - `packages/vscode-extension/src/explainCodeLens.ts` (command reference)
  - Search pattern: `untitled\.` across all TS and JSON files.

- [ ] **Update VS Code settings namespace in `package.json` and all code**
  - `contributes.configuration` properties: rename `untitled.*` → `bluematter.*`
  - All `vscode.workspace.getConfiguration('untitled')` calls in `coreAdapter.ts` → `getConfiguration('bluematter')`
  - All `config.get<…>('untitled.*')` → `config.get<…>('bluematter.*')`

- [ ] **Update `CHANGELOG.md`**
  - File: `packages/vscode-extension/CHANGELOG.md`
  - Change heading and product name from "Untitled" to "Blue Matter" throughout.

- [ ] **Update root `README.md`**
  - Replace all "Untitled" occurrences with "Blue Matter".
  - This file is the developer README; the user-facing marketplace README is a separate task in Milestone 2.

- [ ] **Update `CLAUDE.md`**
  - Update project name, command names, and any "Untitled" references to "Blue Matter".

- [ ] **Update `context.md` and `PRD.md`**
  - Global find-replace "Untitled" → "Blue Matter" for consistency (these are internal docs).

- [ ] **Update `globalState` key for first-run tracking**
  - File: `packages/vscode-extension/src/extension.ts:296`
    ```
    context.globalState.get<boolean>('blue-matter.hasSeenApiKeyPrompt')
    context.globalState.update('blue-matter.hasSeenApiKeyPrompt', true)
    ```

- [ ] **Update `getOrCreateUserId` key** (after S5 below is implemented)
  ```
  context.globalState.get<string>('blue-matter.userId')
  context.globalState.update('blue-matter.userId', newId)
  ```

- [ ] **Smoke test the rename**
  - Run `grep -r "untitled" packages/ --include="*.ts" --include="*.json" -l` and verify the only remaining hits are in comments, test files, or the word "untitled" used generically (e.g., VS Code's `untitled:` URI scheme — leave that alone).

---

## Milestone 2 — Blockers (Must Fix Before Publish)

These prevent the extension from working, mislead users, or are marketplace hard requirements.

---

### B1 — Add esbuild Bundler (Extension Won't Load Without This)

**Why:** `vsce package --no-dependencies` skips `node_modules`. Without bundling, the installed extension cannot find `@untitled/core` (now `@blue-matter/core`) or `marked` and crashes on every activation.

**Files to create/modify:**
- Create `packages/vscode-extension/esbuild.mjs`
- Modify `packages/vscode-extension/package.json` scripts
- Add `esbuild` to devDependencies
- Update `.vscodeignore`

**Steps:**

1. Install esbuild:
   ```bash
   cd packages/vscode-extension && npm install --save-dev esbuild
   ```

2. Create `packages/vscode-extension/esbuild.mjs`:
   ```js
   import esbuild from 'esbuild';
   const watch = process.argv.includes('--watch');

   const ctx = await esbuild.context({
     entryPoints: ['src/extension.ts'],
     bundle: true,
     outfile: 'out/extension.js',
     external: ['vscode'],        // provided by VS Code host — never bundle
     format: 'cjs',
     platform: 'node',
     target: 'node18',
     sourcemap: false,            // no source maps — do not reveal source structure
     minify: !watch,
     logLevel: 'info',
   });

   if (watch) {
     await ctx.watch();
     console.log('[blue-matter] watching...');
   } else {
     await ctx.rebuild();
     await ctx.dispose();
   }
   ```

3. Update `package.json` scripts:
   ```json
   "vscode:prepublish": "npm run bundle",
   "bundle": "node esbuild.mjs",
   "bundle:watch": "node esbuild.mjs --watch",
   "compile": "tsc -p . --noEmit",
   "watch": "tsc -watch -p . --noEmit",
   "package": "vsce package --no-dependencies"
   ```
   > `compile` is now type-check only. `bundle` produces the actual `out/extension.js`.

4. Update `.vscodeignore` — add to the top:
   ```
   node_modules/**
   ```

5. **Handle sql.js WASM** — this is the trickiest part of bundling. sql.js dynamically loads a `.wasm` file at runtime using a relative path. After bundling, the WASM file must still be reachable. Two steps:
   - Find the WASM file: `node_modules/sql.js/dist/sql-wasm.wasm`
   - Add an asset copy step in `esbuild.mjs` before the build:
     ```js
     import { copyFileSync, mkdirSync } from 'fs';
     mkdirSync('out', { recursive: true });
     copyFileSync(
       new URL('./node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url).pathname,
       'out/sql-wasm.wasm'
     );
     ```
   - Configure sql.js `locateFile` in `Database.ts` to point at the correct path. Add a `wasmPath` parameter or use a VS Code extension URI:
     ```typescript
     // In UntitledCore or Database.ts, pass the WASM location:
     const SQL = await initSqlJs({
       locateFile: (file: string) => path.join(__dirname, file),
     });
     ```
     This works because esbuild sets `__dirname` to `out/` and the WASM is copied there.

6. **Verify the bundle:**
   ```bash
   npm run bundle
   # Check: out/extension.js exists and is > 200KB (all deps inlined)
   # Check: out/sql-wasm.wasm exists
   unzip -l blue-matter-0.1.0.vsix | grep -E "\.wasm|extension\.js"
   ```

7. **Install the VSIX on a clean VS Code instance** (no local workspace, no node_modules) and confirm activation with no errors in the Developer Tools console.

---

### B2 — Fix False Privacy Claim

**Why:** The settings UI and README claim standard mode "anonymizes" code. It does not — code is sent verbatim (after null-byte stripping and truncation). This is inaccurate and could trigger Marketplace rejection.

**File 1:** `packages/vscode-extension/package.json:94`
```diff
- "description": "Privacy mode: standard (anonymize code) or strict (cache-only, never send code)"
+ "description": "Privacy mode: standard (sends selected code to OpenRouter AI) or strict (cache-only, no code is ever sent)"
```

**File 2:** `README.md:29` — remove the Anthropic bullet and fix privacy claim:
```diff
- - **Anthropic:** Set **Untitled: API Provider** to `anthropic` and set your Anthropic API key.
- - Code is anonymized before sending in standard privacy mode.
+ - In **standard** mode, selected code is sent to OpenRouter for AI processing.
+ - In **strict** mode, all AI calls are disabled — only previously cached explanations are shown.
```

**File 3:** `README.md:57`
```diff
- - **Privacy** — Standard mode anonymizes code before AI; strict mode is cache-only (no code sent).
+ - **Privacy** — Standard mode sends your selected code to OpenRouter's API. Strict mode is cache-only: no code ever leaves your machine.
```

---

### B3 — Fix Stale `ANTHROPIC_API_KEY` Reference in Info Message

**File:** `packages/vscode-extension/src/extension.ts:282`
```diff
- "Blue Matter: You can set your API key later with 'Blue Matter: Set API Key' or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY."
+ "Blue Matter: You can set your API key later with 'Blue Matter: Set API Key' or set the OPENROUTER_API_KEY environment variable."
```

---

### B4 — Fix Logger Redaction: `sk-or-v1-*` Keys Are Not Redacted

**Why:** The current pattern `/sk-[a-zA-Z0-9]{40,}/g` uses a character class without hyphens. OpenRouter keys (`sk-or-v1-…`) contain hyphens and will not match, so a raw key accidentally interpolated into a log message would appear unredacted.

**File:** `packages/core/src/utils/Logger.ts:5-10`
```diff
- /sk-[a-zA-Z0-9]{40,}/g,
- /sk-ant-[a-zA-Z0-9-_]{40,}/g,
+ /sk-[a-zA-Z0-9_-]{20,}/g,
```
> Merging both patterns: the new pattern covers `sk-or-v1-*`, `sk-ant-*`, and any generic `sk-` key containing hyphens or underscores. Minimum length lowered to 20 since `sk-or-v1-` itself is 9 chars.

**Add unit tests:** Create `packages/core/src/utils/Logger.test.ts` covering:
- Raw `sk-or-v1-*` key in a message string → redacted
- `sk-ant-*` key in a message string → redacted
- `Bearer sk-or-v1-*` in a message string → redacted
- `apiKey` property in a meta object → redacted
- Short safe strings not redacted

---

### B5 — Write the Marketplace README

**Why:** The VS Code Marketplace uses `README.md` from the extension package directory (`packages/vscode-extension/README.md`). This file does not currently exist — the marketplace listing will be blank.

**Create `packages/vscode-extension/README.md`** with the following sections:

1. **Hero image / GIF** — a screen recording of selecting code and seeing an explanation appear. Add to `packages/vscode-extension/assets/` and reference with a relative path. (This requires recording a demo; use VS Code's built-in screen recorder or a tool like Kap on macOS.)

2. **Tagline and one-liner** — what the extension does in one sentence.

3. **Feature list with screenshots:**
   - Inline CodeLens "Explain" buttons above functions and classes
   - The Blue Matter explanation panel (screenshot with markdown explanation rendered)
   - Cache hit ("From cache" badge)
   - Annotations

4. **Setup (3 steps):**
   - Install the extension
   - Get a free API key at openrouter.ai/keys
   - Run `Blue Matter: Set API Key` from the command palette

5. **Keyboard shortcuts table** (copy from root README, update command names to Blue Matter).

6. **Privacy statement** (use the corrected text from B2):
   > In standard mode, selected code is sent to OpenRouter's API for processing. OpenRouter's privacy policy applies. Use strict mode (Settings → Blue Matter: Privacy Mode → strict) to disable all AI calls — only cached explanations are shown.

7. **Supported languages:** JS, TS, JSX, TSX, Python (with context). All other languages work for explanation without repo-map context.

8. **Known limitations (v0.1):**
   - Multi-root workspaces: only the first folder is indexed
   - Symbol extraction uses regex (no full AST); complex patterns may be missed
   - Rate limit resets on VS Code restart (not persisted to disk)

9. **Links:**
   - Report issues: `https://github.com/sakethnandam/blue-matter/issues`
   - Changelog

10. **License notice:** Proprietary — see LICENSE.

---

### B6 — Add Required `keywords` and `galleryBanner` to `package.json`

**File:** `packages/vscode-extension/package.json`

```json
"keywords": ["ai", "code explanation", "openrouter", "learning", "productivity"],
"galleryBanner": {
  "color": "#1a1a2e",
  "theme": "dark"
}
```

> `galleryBanner.color` is the background color of the Marketplace listing header. Adjust to match your brand. `"#1a1a2e"` is a dark navy that complements most icon styles.

---

### B7 — Resolve `ctrl+shift+f` Keybinding Conflict

**Why:** `ctrl+shift+f` is VS Code's built-in "Find in Files" (Windows/Linux) and "Format Document" (in some configurations). Shipping with this default will frustrate users on those platforms.

**File:** `packages/vscode-extension/package.json:114-118`

```diff
  {
    "command": "bluematter.explainFile",
-   "key": "ctrl+shift+f",
-   "mac": "cmd+shift+f"
+   "key": "ctrl+shift+alt+f",
+   "mac": "cmd+shift+alt+f"
  }
```

> Alternative: remove the default keybinding for `explainFile` entirely and let users assign their own. The explain-code binding (`ctrl+shift+e` / `cmd+shift+e`) is safe and should stay.

---

### B8 — Verify Icon Dimensions

**Why:** Marketplace requires 128×128 or 256×256 PNG. A wrong-sized icon causes `vsce package` to fail or display incorrectly.

```bash
# On macOS:
sips -g pixelWidth -g pixelHeight packages/vscode-extension/assets/blue-matter.png
```

- If dimensions are correct: no change needed.
- If not: resize to 256×256 using a tool like ImageMagick (`convert untitled-icon.png -resize 256x256 blue-matter.png`) or any image editor.

---

### B9 — Create Marketplace Publisher Account and Register Publisher ID

**Steps (do before running `vsce publish`):**

1. Go to `https://marketplace.visualstudio.com/manage`
2. Sign in with a Microsoft account
3. Click **Create publisher**
4. Set publisher ID to `blue-matter` (or `bluematter` if hyphens are not accepted)
5. Fill in display name: "Blue Matter"
6. Go to `https://dev.azure.com` → User Settings → Personal Access Tokens
7. Create a PAT:
   - Name: `vsce-publish`
   - Organization: All accessible organizations
   - Scope: Marketplace → Manage
   - Expiry: 1 year
8. Run: `npx vsce login blue-matter` and paste the PAT
9. Update `package.json:publisher` to match the exact ID that was accepted

---

### B10 — End-to-End Install Verification

**Do last in Milestone 2, after all other blockers are fixed:**

1. Build the VSIX:
   ```bash
   cd packages/vscode-extension
   npm run bundle
   npx vsce package --no-dependencies
   ```

2. Inspect the VSIX contents:
   ```bash
   unzip -l blue-matter-0.1.0.vsix
   ```
   Confirm:
   - `extension/out/extension.js` is present and > 200KB
   - `extension/out/sql-wasm.wasm` is present
   - No `src/` TypeScript files
   - No `node_modules/` directory
   - No `.env` files
   - No `*.js.map` source maps
   - No `PRD.md`, `PLAN.md`, `context.md`

3. Install on a **clean VS Code instance** (a fresh user profile or a VM with no extensions):
   ```bash
   code --install-extension blue-matter-0.1.0.vsix --profile clean
   ```

4. Open a JS/TS project, select a function, press `Cmd+Shift+E` / `Ctrl+Shift+E`.
   - First run: API key prompt should appear
   - After entering a valid key: explanation panel should open
   - Second run on same code: "From cache" badge should appear instantly

5. Test `strict` privacy mode: set via settings, then try to explain — should show an error, not call the API.

6. Test network offline: disable WiFi, trigger explain — should fail with a timeout error message, not a crash.

---

## Milestone 3 — Should-Do Before Publish

Strong recommendations. Shipping without these is risky at 100K+ DAU scale.

---

### S1 — Add Cache Eviction (Unbounded Memory Growth)

**Why:** sql.js loads the entire database into RAM on activation. With no eviction, after months of heavy use the in-memory DB could reach hundreds of MB, slowing VS Code startup and causing OOM on low-memory machines.

**File:** `packages/core/src/cache/ExplanationCache.ts` — add method:
```typescript
evictOldEntries(maxEntries = 2000): number {
  const count = this.db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM explanations WHERE user_id = ?',
    this.userId
  )?.count ?? 0;
  if (count <= maxEntries) return 0;
  const excess = count - maxEntries;
  this.db.run(
    `DELETE FROM explanations WHERE user_id = ? AND id IN (
       SELECT id FROM explanations WHERE user_id = ?
       ORDER BY accessed_at ASC LIMIT ?
     )`,
    this.userId, this.userId, excess
  );
  return excess;
}
```

**File:** `packages/core/src/core/UntitledCore.ts:80-84` — call in `initialize()`:
```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;
  await this.db.open();
  this.cache.evictOldEntries(2000);   // add this line
  this.initialized = true;
}
```

Write a test covering: over-limit → oldest entries removed, most-recently-accessed entries kept, under-limit → no-op.

---

### S2 — Add `command:` URI Regression Test

**Why:** `enableCommandUris: true` in the webview means any `command:` URI that escapes URL sanitization would invoke a VS Code command when a user clicks it. The URL validator in `explanationHtml.ts` currently blocks this correctly. This test pins that behavior so a future refactor can't silently break it.

**Create `packages/vscode-extension/src/explanationHtml.test.ts`:**
```typescript
import { markdownToSafeHtml } from './explanationHtml';

describe('markdownToSafeHtml — URI scheme blocking', () => {
  it('converts command: href to #', () => {
    const html = markdownToSafeHtml('[click](command:bluematter.clearStoredApiKey)');
    expect(html).toContain('href="#"');
    expect(html).not.toContain('command:');
  });
  it('converts javascript: href to #', () => {
    expect(markdownToSafeHtml('[x](javascript:alert(1))')).toContain('href="#"');
  });
  it('converts entity-encoded javascript: to #', () => {
    expect(markdownToSafeHtml('[x](&#106;avascript:alert(1))')).toContain('href="#"');
  });
  it('converts vscode: scheme to #', () => {
    expect(markdownToSafeHtml('[x](vscode:extension/foo)')).toContain('href="#"');
  });
  it('preserves https: links', () => {
    expect(markdownToSafeHtml('[docs](https://openrouter.ai)')).toContain('href="https://openrouter.ai"');
  });
});
```

---

### S3 — Add `localResourceRoots` to WebView

**Why:** Without this, the webview can reference any file in the workspace via `vscode-resource:` URIs. Restricting to `assets/` only is defense-in-depth.

**File:** `packages/vscode-extension/src/panel.ts:44-49`
```diff
  this.panel = vscode.window.createWebviewPanel(
    'bluematter-explanations',
    'Blue Matter',
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
      retainContextWhenHidden: true,
      enableCommandUris: true,
+     localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'assets')],
    }
  );
```

---

### S4 — Add GitHub Actions CI Pipeline

**Why:** Catches dependency vulnerabilities and broken builds automatically on every push.

**Create `.github/workflows/ci.yml`:**
```yaml
name: CI
on:
  push:
    branches: [master, main]
  pull_request:
  schedule:
    - cron: '0 9 * * 1'   # Monday 9am UTC — catch newly disclosed CVEs

jobs:
  audit:
    name: Security audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: cd packages/core && npm audit --audit-level=high
      - run: cd packages/vscode-extension && npm audit --audit-level=high

  test:
    name: Build and test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: cd packages/core && npm run build && npm test
      - run: cd packages/vscode-extension && npm run bundle
```

---

### S5 — Persistent `userId` via `crypto.randomUUID()`

**Why:** The current `userId` is `'vscode-' + process.env.USER`. On machines where `USER` is unset (some containers, CI environments), all users get `'vscode-default'` and share the same cache bucket. A UUID persisted in `globalState` is more robust.

**File:** `packages/vscode-extension/src/extension.ts` — replace line 73:
```typescript
// Before:
const userId = 'vscode-' + (process.env.USER ?? 'default');

// After — add this function above activate():
function getOrCreateUserId(context: vscode.ExtensionContext): string {
  const key = 'blue-matter.userId';
  const stored = context.globalState.get<string>(key);
  if (stored) return stored;
  const { randomUUID } = require('crypto') as typeof import('crypto');
  const id = `bm-${randomUUID()}`;
  void context.globalState.update(key, id);
  return id;
}

// In activate():
const userId = getOrCreateUserId(context);
```

---

### S6 — Enforce Per-Day Rate Limit

**Why:** The `explanationsPerDay: 1000` config value is documented in the settings but never checked at runtime. Only the hourly limit is enforced.

**File:** `packages/core/src/ai/AIOrchestrator.ts`

Replace `private readonly callTimestamps: number[] = []` and `checkRateLimit()` with:
```typescript
private readonly hourTimestamps: number[] = [];
private readonly dayTimestamps: number[] = [];

private checkRateLimit(): void {
  const now = Date.now();
  while (this.hourTimestamps[0] < now - 3_600_000) this.hourTimestamps.shift();
  while (this.dayTimestamps[0] < now - 86_400_000) this.dayTimestamps.shift();

  const hourLimit = this.config.rateLimits?.explanationsPerHour ?? 100;
  const dayLimit = this.config.rateLimits?.explanationsPerDay ?? 1000;

  if (this.hourTimestamps.length >= hourLimit)
    throw new Error(`Rate limit: max ${hourLimit} explanations per hour. Try again later.`);
  if (this.dayTimestamps.length >= dayLimit)
    throw new Error(`Rate limit: max ${dayLimit} explanations per day. Try again tomorrow.`);

  this.hourTimestamps.push(now);
  this.dayTimestamps.push(now);
}
```

---

### S7 — Add `Content-Type` Guard Before `response.json()`

**Why:** If OpenRouter returns an HTML error page (e.g., during an outage) instead of JSON, `response.json()` throws a raw `SyntaxError` that becomes "Unexpected token < in JSON" — confusing to users.

**File:** `packages/core/src/ai/providers/OpenRouterProvider.ts:92`
```diff
  private async parseSuccessResponse(response: Response) {
+   const ct = response.headers.get('content-type') ?? '';
+   if (!ct.includes('application/json')) {
+     throw new Error('Unexpected response from OpenRouter. Check your connection and try again.');
+   }
    const data = (await response.json()) as { ... };
```

---

### S8 — Manual Functional Test Pass

Run through every scenario below on the bundled VSIX installed in a clean VS Code profile. Check each off only after confirming it works.

- [ ] Fresh install → API key prompt appears after 2-second delay
- [ ] API key prompt: entering invalid key → inline error, not stored
- [ ] API key prompt: entering valid `sk-or-v1-*` key → stored, no further prompts
- [ ] Select 3 lines of JS → `Cmd+Shift+E` → explanation panel opens with content
- [ ] Explain same selection again → "From cache" badge, near-instant
- [ ] `Cmd+Shift+F` (or updated binding) on an open file → explanation of full file
- [ ] CodeLens "Explain" button appears above a function → clicking it → explanation opens
- [ ] Add annotation → restart VS Code → search annotation → result found
- [ ] Set privacy mode to `strict` → try explain → "AI calls are disabled" error
- [ ] Disconnect network → try explain → timeout error in ~30 seconds, no crash
- [ ] Enter expired/revoked key → try explain → clear 401 error with no key in message
- [ ] Open VS Code with no workspace folder → extension activates cleanly, status bar visible
- [ ] Open a file > 50KB, select all → try explain → "Code block too large" error
- [ ] `Blue Matter: Clear Stored API Key` → stored key removed → next explain prompts for key

---

### S9 — Remove Orphaned `@types/crypto-js` Dependency

**File:** `packages/core/package.json`
```diff
  "devDependencies": {
-   "@types/crypto-js": "^4.2.2",
    "@types/jest": "^30.0.0",
```
> `crypto-js` is not used anywhere in the codebase; the extension uses Node's built-in `crypto` module. This is dead weight.

---

## Milestone 4 — Post-Launch (Nice-to-Have)

Fix after v0.1 ships. These are low-risk quality improvements.

| # | Task | File | Notes |
|---|------|------|-------|
| P1 | Annotation IDs: replace `Math.random()` with `crypto.randomUUID()` | `AnnotationManager.ts:28` | Prevents predictable ID enumeration |
| P2 | Periodic DB flush every 60s (not just on deactivation) | `Database.ts` | Prevents cache loss on VS Code crash |
| P3 | Per-file size limit in CodeIndexer (skip files > 500KB) | `CodeIndexer.ts` | Prevents memory spike from oversized generated files |
| P4 | Multi-root workspace: index all workspace folders, not just the first | `extension.ts:71` | Usability for monorepo users |
| P5 | Add `**/*.d.ts.map` to `.vscodeignore` | `.vscodeignore` | Prevents declaration source maps from shipping in VSIX |
| P6 | Honor `.gitignore` patterns in `FileDiscovery` | `FileDiscovery.ts` | Users expect gitignored files to also be ignored by Blue Matter |
| P7 | Debounce `indexWorkspace` command (minimum 30s between invocations) | `extension.ts` | Prevents rapid sequential indexing via task automation |
| P8 | `VACUUM` after cache eviction | `ExplanationCache.ts` | Reclaims disk space after bulk entry deletion |
| P9 | ARIA roles on dashboard action buttons in webview HTML | `panel.ts` | Accessibility |
| P10 | Choose and add an open source license (MIT, Apache 2.0) | `LICENSE` | Users and enterprises often require a known license |

---

## Summary: Effort Estimate

| Milestone | Tasks | Estimated Time |
|-----------|-------|---------------|
| M1 — Rebranding | 15 tasks | 3–4 hours |
| M2 — Blockers | B1–B10 | 8–10 hours |
| M3 — Should-do | S1–S9 | 6–7 hours |
| M4 — Post-launch | P1–P10 | 10–12 hours |
| **Total to publish** | **M1 + M2 + M3** | **~20 hours** |

> M4 is deferred — the extension is publishable without it.
> The single highest-effort task is **B1** (bundling + sql.js WASM). Budget 3–4 hours for that alone and test it thoroughly before moving on.
