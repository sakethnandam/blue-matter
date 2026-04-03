# Run & Debug

Use **Run and Debug** (or F5) and pick **Run Blue Matter Extension** to launch the Extension Development Host with Blue Matter loaded.

## Console warnings (safe to ignore)

When running the extension you may see:

| Message | Cause | Action |
|--------|--------|--------|
| **ExperimentalWarning: SQLite is an experimental feature** | VS Code / Electron or another extension using Node’s experimental SQLite. Not from Blue Matter. | Ignore, or set `NODE_OPTIONS=--disable-warning=ExperimentalWarning` in your environment (Node 22+). |
| **punycode module is deprecated** | A dependency (e.g. in the extension host) still uses the old `punycode` module. | Already suppressed in our launch config via `NODE_OPTIONS=--no-deprecation`. |
| **LARGE file … github.copilot-chat** | GitHub Copilot Chat extension’s storage file. | Ignore, or clear Copilot Chat data in Settings if you want. |

The launch configs set `NODE_OPTIONS=--no-deprecation` so deprecation warnings (like punycode) are hidden. The SQLite experimental warning comes from the host/other extensions and does not affect Blue Matter.
