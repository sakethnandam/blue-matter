# Publishing Blue Matter to the VS Code Marketplace

This guide walks through everything from creating your publisher account to submitting the `.vsix` file. Do the steps in order.

---

## Step 1 — Microsoft account

You need a Microsoft account to sign in to the Marketplace.

- If you already have one (Outlook, Xbox, Azure, etc.) you can use it directly.
- If not, create one at **https://account.microsoft.com**.

---

## Step 2 — Create a publisher on the VS Code Marketplace

1. Go to **https://marketplace.visualstudio.com/manage**
2. Sign in with your Microsoft account.
3. Click **"Create publisher"**.
4. Fill in the form:
   - **Publisher ID**: `blue-matter` ← this must match the `publisher` field in `package.json` exactly. IDs are first-come-first-served. If `blue-matter` is already taken, pick an alternative (e.g. `bluematter`, `blue-matter-dev`) and update `package.json` to match before building.
   - **Display name**: `Blue Matter`
   - **Description**: optional, e.g. "AI code explanations for VS Code"
5. Click **"Create"**.

> **Note:** Publisher IDs are permanent and public. The final Marketplace URL will be:
> `https://marketplace.visualstudio.com/items?itemName=blue-matter.blue-matter`

---

## Step 3 — Build the `.vsix` file

Run these commands from the repo root:

```bash
# 1. Make sure everything is built and tests pass
cd packages/core && npm run build && npm test
cd ../vscode-extension && npm run compile

# 2. Bundle and package
npm run bundle
npm run package
```

This produces **`blue-matter-0.1.0.vsix`** inside `packages/vscode-extension/`.

> If you get a vsce warning about missing fields, check that `icon`, `repository`, `license`, and `description` are all set in `package.json` — they already are.

---

## Step 4 — Upload to the Marketplace

1. Go to **https://marketplace.visualstudio.com/manage** and sign in.
2. Under your `blue-matter` publisher, click **"New extension"** → **"Visual Studio Code"**.
3. Drag and drop (or browse to) `packages/vscode-extension/blue-matter-0.1.0.vsix`.
4. Click **"Upload"**.

The Marketplace will parse the `.vsix` and pre-fill the listing from your `README.md`, `CHANGELOG.md`, `package.json`, and icon automatically.

5. Review the listing preview, then click **"Save & Upload"** (or **"Publish"** depending on the UI — both submit it for review).

---

## Step 5 — What happens after you submit

- Microsoft runs an automated scan on the `.vsix` (usually a few minutes).
- The extension then enters **manual review** — typically **1–3 business days** for a new publisher's first submission.
- You'll get an email at your Microsoft account address when it's approved or if there are issues.
- Once approved it appears in Marketplace search and `ext install blue-matter.blue-matter` works in VS Code.

---

## Step 6 — Install check (after approval)

Users install it like any other extension:

1. Open VS Code.
2. Go to Extensions (`Cmd+Shift+X`).
3. Search **"Blue Matter"**.
4. Click **Install**.

No debug mode, no terminal. It activates automatically on every VS Code launch after that.

---

## Checklist before you upload

Run through this before building the `.vsix`:

- [ ] `cd packages/core && npm test` — all 96 tests pass
- [ ] `cd packages/vscode-extension && npm run compile` — 0 TypeScript errors
- [ ] `npm run bundle` — builds cleanly (the one `[WARNING]` about `types` is harmless)
- [ ] Publisher ID `blue-matter` is registered and matches `package.json`
- [ ] `npm run package` produces `blue-matter-0.1.0.vsix`
- [ ] Test the `.vsix` locally first (see below)

### Test the `.vsix` locally before submitting

```bash
# Install it directly into your VS Code to verify it works end-to-end
code --install-extension packages/vscode-extension/blue-matter-0.1.0.vsix
```

Reload VS Code, open a file, select some code, press `Cmd+Shift+E`. If it prompts for an API key and explains code correctly, you're good to submit.

---

## If `blue-matter` publisher ID is already taken

Update `publisher` in `packages/vscode-extension/package.json`:

```json
"publisher": "your-chosen-id"
```

Then rebuild and repackage:

```bash
cd packages/vscode-extension && npm run bundle && npm run package
```

The rest of the steps are identical.

---

## Future releases

When you're ready to publish an update:

1. Bump the version in `packages/vscode-extension/package.json` (e.g. `0.1.0` → `0.2.0`).
2. Add a new entry to `CHANGELOG.md`.
3. Run `npm run bundle && npm run package`.
4. Go to **https://marketplace.visualstudio.com/manage**, click your extension, click **"Update"**, and upload the new `.vsix`.
