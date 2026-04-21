# Changelog

## [0.2.0] - 2026-04-20

### Improved
- **More accurate Python context** — symbol extraction for Jupyter notebooks and `# %%` Python cell-mode files now uses a full AST parser (`@lezer/python`) instead of regex. Multi-line imports, type-annotated variables, decorated classes/functions, and starred unpacking assignments are now correctly captured and included in cross-cell context.
- **More accurate AI explanations** — AI calls now use `temperature: 0`, reducing sampling variance and making responses more consistent. This minimises but does not eliminate variation, as results remain subject to model behaviour and provider implementation. In practice it resolves the occasional factually wrong explanation seen on first load.

### Fixed
- Preceding notebook cells were passed to the Python parser without a size cap or null-byte stripping. They are now pre-processed consistently with the selected cell (100 KB cap, null bytes removed).
- Notebook dependency summary was embedded in AI prompts without sanitization. It now goes through the same `sanitizeAnnotation` pass used for the repo map.

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
