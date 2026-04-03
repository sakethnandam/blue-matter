# Blue Matter — AI Code Explanations for VS Code

Context-aware AI explanations for any code you select. Understands your repo, caches results, and explains in plain English.

## Setup (3 steps)

1. **Install** the Blue Matter extension from the VS Code Marketplace.
2. **Get a free API key** at [openrouter.ai/keys](https://openrouter.ai/keys).
3. **Run** `Blue Matter: Set API Key` from the Command Palette (`Cmd+Shift+P`).

## Features

- **Explain Selected Code** — Select any code block and press `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux). An explanation appears in a side panel instantly.
- **Explain Current File** — Press `Cmd+Shift+Alt+F` to get a plain-English summary of the entire open file.
- **Inline CodeLens** — "Explain" buttons appear above functions and classes. Click to explain without selecting.
- **From cache badge** — Previously explained code loads instantly from a local cache, no API call needed.
- **Annotations** — Add your own notes to code blocks with `Cmd+Shift+N`. Search them later with `Blue Matter: Search Annotations`.
- **Workspace indexing** — Blue Matter indexes your repo's symbols and imports to give richer, context-aware explanations.

## Keyboard Shortcuts

| Command | Mac | Windows / Linux |
|---------|-----|-----------------|
| Explain Selected Code | `Cmd+Shift+E` | `Ctrl+Shift+E` |
| Explain Current File | `Cmd+Shift+Alt+F` | `Ctrl+Shift+Alt+F` |
| Add Annotation | `Cmd+Shift+N` | `Ctrl+Shift+N` |

## Privacy

In **standard** mode, selected code is sent to [OpenRouter's API](https://openrouter.ai) for AI processing. OpenRouter's privacy policy applies.

In **strict** mode (Settings → Blue Matter: Privacy Mode → `strict`), all AI calls are disabled — only previously cached explanations are shown. No code ever leaves your machine.

Your API key is stored in your OS keychain via VS Code SecretStorage and is never written to settings files or logs.

## Supported Languages

Full context-aware explanations (with repo map):
- JavaScript / TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`)
- Python (`.py`)

All other languages work for basic explanation without repo-map context.

## Known Limitations (v0.1)

- Multi-root workspaces: only the first folder is indexed.
- Symbol extraction uses regex (no full AST); complex patterns may be missed.
- Rate limit resets on VS Code restart (not persisted to disk).

## Links

- [Report issues](https://github.com/sakethnandam/blue-matter/issues)
- [Changelog](CHANGELOG.md)

## License

Proprietary — see LICENSE.
