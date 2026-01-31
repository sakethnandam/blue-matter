# untitled

Your code is untitled until you own it.

A VS Code / Cursor extension that analyzes your Python code (file or selection), detects concepts (data structures, loops, libraries), and shows explainer videos plus contextual summaries so you learn on a **use-and-learn** basis.

## How to use

1. Open a Python file. When you open the **untitled** panel (via Command Palette or by clicking **Explain**), it opens **side-by-side** with your code (to the right of the editor).
2. **From the editor:** Select some code. An **Explain** CodeLens appears above the selection. Click it to open the panel (if needed) and run **Explain selection**.
3. **From the Command Palette (Cmd+Shift+P):** Run **untitled: Open panel** to show the panel, then in the panel click **Explain file** or **Explain selection**. You can also run **untitled: Explain file** or **untitled: Explain selection** directly.
4. For each detected concept you get:
   - A short explainer video (YouTube, 1–5 min, 5k+ views) when a YouTube API key is set.
   - A contextual summary and **See alternatives** (e.g. deque vs list) when an LLM API key is set.

## Settings

**Recommended: use a `.env` file** so your API keys stay out of version control. Copy `.env.example` to `.env` in your workspace root and add your keys:

```env
UNTITLED_YOUTUBE_API_KEY=your_youtube_api_key
UNTITLED_LLM_API_KEY=your_openai_or_anthropic_or_openrouter_key
UNTITLED_LLM_PROVIDER=openai
# For free LLM via OpenRouter (see below):
# UNTITLED_LLM_PROVIDER=openrouter
# UNTITLED_OPENROUTER_MODEL=google/gemma-3-4b-it:free
```

These env vars override VS Code settings when set. Do not commit `.env` (it is in `.gitignore`).

**Alternatively**, configure in **Settings** (search for `untitled`):

| Setting | Description |
|--------|-------------|
| `untitled.youtubeApiKey` | YouTube Data API v3 key. Get one in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Enable "YouTube Data API v3". |
| `untitled.llmApiKey` | API key for OpenAI, Anthropic, or OpenRouter (for contextual summaries and alternatives). |
| `untitled.llmProvider` | `openai`, `anthropic`, or `openrouter`. Use `openrouter` for free models. |
| `untitled.openRouterModel` | OpenRouter model ID (e.g. `google/gemma-3-4b-it:free`). Append `:free` for free models. |

Videos and summaries are fetched with your keys; no backend required.

---

### Using a free LLM with OpenRouter

You can use a **free** model via [OpenRouter](https://openrouter.ai) instead of paid OpenAI/Anthropic. Steps:

**Step 1: Get an OpenRouter API key**

1. Go to [https://openrouter.ai](https://openrouter.ai).
2. Click **Sign in** (top right) and sign in with Google, GitHub, or email.
3. Open your **Keys** page: click your profile/avatar (top right) and choose **Keys**, or go to [https://openrouter.ai/keys](https://openrouter.ai/keys).
4. Click **Create Key**.
5. Give the key a name (e.g. `untitled`), leave permissions as default, and create the key.
6. Copy the key and store it somewhere safe (you may only see it once).

**Step 2: Pick a free model**

OpenRouter has many models; free ones use the `:free` suffix. Examples:

- `google/gemma-3-4b-it:free` (default in untitled)
- `meta-llama/llama-3.2-3b-instruct:free`

Browse more at [OpenRouter – Free models](https://openrouter.ai/collections/free-models).

**Step 3: Configure untitled**

**Option A – `.env` (recommended)**

In your workspace root, create or edit `.env` (copy from `.env.example` if needed) and set:

```env
UNTITLED_LLM_PROVIDER=openrouter
UNTITLED_LLM_API_KEY=sk-or-v1-xxxxxxxxxxxx
UNTITLED_OPENROUTER_MODEL=google/gemma-3-4b-it:free
```

Replace `sk-or-v1-xxxxxxxxxxxx` with your real OpenRouter API key. Use any free model ID you like for `UNTITLED_OPENROUTER_MODEL`.

**Option B – VS Code/Cursor settings**

1. Open Settings (Cmd+, / Ctrl+,).
2. Search for `untitled`.
3. Set **untitled: Llm Provider** to `openrouter`.
4. Set **untitled: Llm Api Key** to your OpenRouter API key.
5. Set **untitled: Open Router Model** to e.g. `google/gemma-3-4b-it:free`.

**Step 4: Reload and use**

Reload the window (Command Palette → “Developer: Reload Window”) if the extension was already running. Open a Python file, run **Explain file** or **Explain selection**, and summaries will use the free OpenRouter model.

## Development

```bash
npm install
npm run compile
```

Then run the extension from VS Code/Cursor (F5 with "Run and Debug" for the Extension Development Host).

## Concepts (v1)

- **Data structures:** list, dict, set, tuple, deque, defaultdict, Counter, OrderedDict
- **Loops:** for, while, list/dict/set comprehensions, generators
- **Libraries:** pathlib, requests, collections, itertools, os, json, re, dataclasses, typing

You can extend the taxonomy and add curated video IDs in `src/taxonomy/concepts.ts`.
