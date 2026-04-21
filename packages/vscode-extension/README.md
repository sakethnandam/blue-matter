# Blue Matter — AI Code Explanations for VS Code

Context-aware AI explanations for any code you select. Understands your repo, caches results, and explains in plain English.

## Setup (3 steps)

1. **Install** the Blue Matter extension from the VS Code Marketplace.
2. **Get a free API key** at [openrouter.ai/keys](https://openrouter.ai/keys).
3. **Run** `Blue Matter: Set API Key` from the Command Palette (`Cmd+Shift+P`).

## Features

- **Explain Selected Code** — Select any code block and press `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux). An explanation appears in a side panel instantly.
- **Inline CodeLens** — "Explain" button appears above your selection. Click to explain without using the keyboard shortcut.
- **Jupyter notebook support** — Works inside `.ipynb` notebook cells. Blue Matter automatically includes context from earlier cells (imports, variables, functions defined in prior cells) so explanations reference what was defined previously. Cell context is parsed with a full Python AST, so multi-line imports, decorated classes, and complex assignments are all understood correctly.
- **Python cell mode** — Works in `.py` files that use `# %%` cell markers (VS Code Python Interactive Window / Jupyter-style cells).
- **From cache** — Previously explained code loads instantly from a local cache with no API call.
- **Annotations** — Add your own notes to code blocks with `Cmd+Shift+N`. Search them later with `Blue Matter: Search Annotations`.
- **Workspace indexing** — Blue Matter indexes your repo's symbols and imports (including `.ipynb` notebooks) to give richer, context-aware explanations.

## Keyboard Shortcuts

| Command | Mac | Windows / Linux |
|---------|-----|-----------------|
| Explain Selected Code | `Cmd+Shift+E` | `Ctrl+Shift+E` |
| Add Annotation | `Cmd+Shift+N` | `Ctrl+Shift+N` |

## Privacy

In **standard** mode, selected code is sent to [OpenRouter's API](https://openrouter.ai) for AI processing. OpenRouter's privacy policy applies.

In **strict** mode (Settings → Blue Matter: Privacy Mode → `strict`), all AI calls are disabled — only previously cached explanations are shown. No code ever leaves your machine.

Your API key is stored in your OS keychain via VS Code SecretStorage and is never written to settings files or logs.

## Supported Languages

Full context-aware explanations (with repo map):
- JavaScript / TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`)
- Python (`.py`, `.ipynb`)

All other languages work for basic explanation without repo-map context.

## Known Limitations

- Multi-root workspaces: only the first folder is indexed.
- Rate limit resets on VS Code restart (not persisted to disk).

## Links

- [Report issues](https://github.com/sakethnandam/blue-matter/issues)
- [Changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
