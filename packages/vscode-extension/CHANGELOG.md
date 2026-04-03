# Changelog

## [0.1.0] - 2026-04-01

### Added
- Initial release of Blue Matter — context-aware code explanations powered by OpenRouter LLMs.
- **Explain Selected Code** (Cmd+Shift+E / Ctrl+Shift+E) — explain any highlighted code block in plain English.
- **Explain Current File** (Cmd+Shift+F / Ctrl+Shift+F) — explain the full active file.
- **CodeLens** — inline "Explain" buttons above functions and classes.
- **Explanation panel** — side-by-side webview with markdown-rendered explanation and source code.
- **Annotations** — add and search personal notes tied to code hashes.
- **Workspace indexing** — auto-indexes code symbols for richer context in explanations.
- **Privacy mode** — `strict` mode disables all AI calls; `standard` mode sends code to OpenRouter.
- **Secure API key storage** — key stored in OS keychain via VS Code SecretStorage, never in settings.
- **Rate limiting** — configurable per-hour explanation cap (default 100).
- OpenRouter free-tier support with automatic fallback model.
