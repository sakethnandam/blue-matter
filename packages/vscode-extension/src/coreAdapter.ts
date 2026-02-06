/**
 * Adapter: loads @untitled/core and creates UntitledCore with VS Code config.
 * API key is stored in OS keychain via SecretStorage (PRD 6.2, 6.3.2).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Secret key for API key in VS Code SecretStorage (OS keychain). */
export const UNTITLED_API_KEY_SECRET = 'untitled-api-key';

const DEBUG_LOG = (loc: string, msg: string, data?: Record<string, unknown>) => {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f2bd9afe-b006-43ba-88a7-eec12bcad0f2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: loc, message: msg, data: data ?? {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' }) }).catch(() => {});
  // #endregion
};

let coreInstance: import('@untitled/core').UntitledCore | null = null;
let coreConfig: { workspaceRoot: string; storagePath: string; userId: string } | null = null;

/** Validates API key format (Anthropic, Open Router, or generic sk-). Never log the key. */
function isValidApiKeyFormat(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length < 20) return false;
  // Anthropic: sk-ant-...
  if (/^sk-ant-[a-zA-Z0-9-]{40,}$/.test(trimmed)) return true;
  // Open Router: sk-or-v1-...
  if (/^sk-or-v1-[a-zA-Z0-9-_]+$/.test(trimmed)) return true;
  // Generic sk- with sufficient length
  if (/^sk-[a-zA-Z0-9-_]{40,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Resolves API key: SecretStorage first, then one-time migration from settings, then env.
 * Invalid stored key is deleted and treated as missing.
 */
async function resolveApiKey(context: vscode.ExtensionContext): Promise<string> {
  const config = vscode.workspace.getConfiguration('untitled');
  const provider = config.get<string>('apiProvider') || 'openrouter';

  let key = await context.secrets.get(UNTITLED_API_KEY_SECRET);
  if (key) {
    if (!isValidApiKeyFormat(key)) {
      await context.secrets.delete(UNTITLED_API_KEY_SECRET);
      key = undefined;
    }
  }
  if (key?.trim()) return key.trim();

  // One-time migration: settings -> SecretStorage
  const fromSettings = config.get<string>('apiKey')?.trim();
  if (fromSettings && isValidApiKeyFormat(fromSettings)) {
    await context.secrets.store(UNTITLED_API_KEY_SECRET, fromSettings);
    await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    return fromSettings;
  }
  if (fromSettings) {
    vscode.window.showWarningMessage(
      'Untitled: API key in settings was not migrated (invalid format). Use "Untitled: Set API Key" to store a valid key securely.'
    );
  }

  const fromEnv =
    provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY?.trim()
      : process.env.ANTHROPIC_API_KEY?.trim();
  return fromEnv || '';
}

/** Returns true if a key is available from SecretStorage or env (no migration). */
export async function hasStoredApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('untitled');
  const provider = config.get<string>('apiProvider') || 'openrouter';
  const fromSecrets = await context.secrets.get(UNTITLED_API_KEY_SECRET);
  if (fromSecrets && isValidApiKeyFormat(fromSecrets)) return true;
  const fromEnv =
    provider === 'openrouter'
      ? process.env.OPENROUTER_API_KEY?.trim()
      : process.env.ANTHROPIC_API_KEY?.trim();
  return !!fromEnv;
}

/** Prompt user to enter API key; store in SecretStorage only (PRD: OS keychain). */
export async function promptForApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const config = vscode.workspace.getConfiguration('untitled');
  const provider = config.get<string>('apiProvider') || 'openrouter';
  const providerLabel =
    provider === 'openrouter'
      ? 'Open Router (free at https://openrouter.ai/keys)'
      : provider === 'anthropic'
        ? 'Anthropic'
        : 'AI provider';
  const key = await vscode.window.showInputBox({
    title: 'Untitled: API Key',
    prompt: `Enter your ${providerLabel} API key. Your key is stored in your system keychain and only used for code explanations.`,
    placeHolder: provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-ant-...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) return 'Please enter an API key.';
      if (!isValidApiKeyFormat(trimmed))
        return 'Invalid key format. Use a valid API key (e.g. sk-ant-... or sk-or-v1-...).';
      return null;
    },
  });
  if (!key?.trim()) return false;
  const trimmed = key.trim();
  if (!isValidApiKeyFormat(trimmed)) {
    vscode.window.showErrorMessage('Untitled: Invalid API key format. Key was not stored.');
    return false;
  }
  await context.secrets.store(UNTITLED_API_KEY_SECRET, trimmed);
  vscode.window.showInformationMessage(
    'Untitled: API key saved securely. You can now use Explain (Cmd+Shift+E).'
  );
  return true;
}

/** Ensure an API key is configured; prompt once if missing. Returns true if key is now set. */
export async function ensureApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const key = await resolveApiKey(context);
  if (key) return true;
  return promptForApiKey(context);
}

/** Securely delete stored API key from keychain (PRD 6.4.1 GDPR). */
export async function clearStoredApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(UNTITLED_API_KEY_SECRET);
}

export async function getCore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  storagePath: string,
  userId: string
): Promise<import('@untitled/core').UntitledCore> {
  // #region agent log
  DEBUG_LOG('coreAdapter.ts:getCore', 'getCore called', {
    hasExistingCore: !!coreInstance,
    workspaceRoot: workspaceRoot.slice(0, 40),
  });
  // #endregion
  if (coreInstance && coreConfig?.workspaceRoot === workspaceRoot) {
    return coreInstance;
  }
  if (coreInstance) {
    await coreInstance.shutdown();
    coreInstance = null;
  }

  const untitled = await import('@untitled/core');
  const config = vscode.workspace.getConfiguration('untitled');
  let apiProvider = config.get<string>('apiProvider') || 'openrouter';
  let apiKey = await resolveApiKey(context);
  if (!apiKey) {
    const configured = await ensureApiKey(context);
    if (!configured) {
      throw new Error(
        'API key is required to explain code. Run "Untitled: Set API Key" or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY.'
      );
    }
    apiKey = await resolveApiKey(context);
  }
  apiProvider = config.get<string>('apiProvider') || 'openrouter';

  const openRouterModel = config.get<string>('openRouterModel') || 'nvidia/nemotron-3-nano-30b-a3b:free';
  const privacyMode = config.get<string>('privacyMode') || 'standard';
  const explanationsPerHour = config.get<number>('explanationsPerHour') ?? 100;

  const storageDir = path.dirname(path.join(storagePath, 'untitled.db'));
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // #region agent log
  DEBUG_LOG('coreAdapter.ts:getCore', 'getCore creating UntitledCore instance', {
    aiProvider: apiProvider,
  });
  // #endregion
  coreInstance = new untitled.UntitledCore({
    userId,
    storagePath: storageDir,
    workspaceRoot,
    apiKey: apiKey || undefined,
    aiProvider: apiProvider as 'anthropic' | 'openai' | 'openrouter' | 'local',
    openRouterModel: apiProvider === 'openrouter' ? openRouterModel : undefined,
    privacyMode: privacyMode as 'standard' | 'strict',
    rateLimits: {
      explanationsPerHour,
      explanationsPerDay: 1000,
      maxConcurrentRequests: 3,
      maxCodeBlockSize: 50000,
    },
    indexing: {
      autoIndex: true,
      debounceMs: 1000,
      maxFilesToIndex: 10000,
      maxTotalSizeBytes: 50 * 1024 * 1024,
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
    },
  });
  coreConfig = { workspaceRoot, storagePath, userId };
  // #region agent log
  DEBUG_LOG('coreAdapter.ts:getCore', 'getCore calling core.initialize()', {});
  // #endregion
  await coreInstance.initialize();
  // #region agent log
  DEBUG_LOG('coreAdapter.ts:getCore', 'getCore core initialized', {});
  // #endregion
  return coreInstance;
}
