# Changelog

## [0.1.0] - 2026-04-03

### Added
- Initial release of Blue Matter — context-aware code explanations powered by OpenRouter LLMs.
- **Explain Selected Code** (Cmd+Shift+E / Ctrl+Shift+E) — explain any highlighted code block in plain English.
- **CodeLens** — inline "Explain" button above selections in supported files. Click to explain without using the keyboard shortcut.
- **Jupyter notebook support** — Explain code inside `.ipynb` notebook cells. Cross-cell context (imports and variables from earlier cells) is automatically included in the explanation.
- **Python cell mode** — Explain code in `.py` files that use `# %%` cell markers (VS Code Python Interactive Window).
- **Explanation panel** — side-by-side webview with markdown-rendered explanation and source code.
- **Annotations** — add and search personal notes tied to code hashes.
- **Workspace indexing** — auto-indexes code symbols (including `.ipynb` notebooks) for richer context in explanations.
- **Privacy mode** — `strict` mode disables all AI calls; `standard` mode sends selected code to OpenRouter.
- **Secure API key storage** — key stored in OS keychain via VS Code SecretStorage, never in settings.
- **Rate limiting** — configurable per-hour explanation cap (default 100).
- OpenRouter free-tier support with automatic fallback model.
