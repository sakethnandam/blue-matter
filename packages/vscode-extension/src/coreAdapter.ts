/**
 * Adapter: loads @blue-matter/core and creates BlueMatterCore with VS Code config.
 * API key is stored in OS keychain via SecretStorage (PRD 6.2, 6.3.2).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/** Secret key for API key in VS Code SecretStorage (OS keychain). */
export const BLUE_MATTER_API_KEY_SECRET = 'blue-matter-api-key';

let coreInstance: import('@blue-matter/core').BlueMatterCore | null = null;
let coreConfig: { workspaceRoot: string; storagePath: string; userId: string } | null = null;
/** In-flight init promise — prevents concurrent getCore() calls from creating multiple instances. */
let coreInitPromise: Promise<import('@blue-matter/core').BlueMatterCore> | null = null;

/** OpenRouter model names must follow the org/model or org/model:variant pattern. */
function isValidModelName(model: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._\-]{0,63}\/[a-zA-Z0-9][a-zA-Z0-9._\-:]{0,100}$/.test(model);
}

/** Validates Open Router API key format. Never log the key. */
function isValidApiKeyFormat(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length < 20) return false;
  // Open Router: sk-or-v1-...
  if (/^sk-or-v1-[a-zA-Z0-9-_]+$/.test(trimmed)) return true;
  // Generic sk- with sufficient length (fallback for custom deployments)
  if (/^sk-[a-zA-Z0-9-_]{40,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Resolves API key: SecretStorage first, then one-time migration from settings, then env.
 * Invalid stored key is deleted and treated as missing.
 */
async function resolveApiKey(context: vscode.ExtensionContext): Promise<string> {
  const config = vscode.workspace.getConfiguration('bluematter');

  let key = await context.secrets.get(BLUE_MATTER_API_KEY_SECRET);
  if (key) {
    if (!isValidApiKeyFormat(key)) {
      await context.secrets.delete(BLUE_MATTER_API_KEY_SECRET);
      key = undefined;
    }
  }
  if (key?.trim()) return key.trim();

  // One-time migration: settings -> SecretStorage
  const fromSettings = config.get<string>('apiKey')?.trim();
  if (fromSettings && isValidApiKeyFormat(fromSettings)) {
    await context.secrets.store(BLUE_MATTER_API_KEY_SECRET, fromSettings);
    await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    return fromSettings;
  }
  if (fromSettings) {
    vscode.window.showWarningMessage(
      'Blue Matter: API key in settings was not migrated (invalid format). Use "Blue Matter: Set API Key" to store a valid key securely.'
    );
  }

  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  return fromEnv || '';
}

/** Returns true if a key is available from SecretStorage or env (no migration). */
export async function hasStoredApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const fromSecrets = await context.secrets.get(BLUE_MATTER_API_KEY_SECRET);
  if (fromSecrets && isValidApiKeyFormat(fromSecrets)) return true;
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  return !!fromEnv;
}

/** Prompt user to enter Open Router API key; store in SecretStorage only (PRD: OS keychain). */
export async function promptForApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const key = await vscode.window.showInputBox({
    title: 'Blue Matter: API Key',
    prompt: 'Enter your Open Router API key (free at https://openrouter.ai/keys). Your key is stored in your system keychain and only used for code explanations.',
    placeHolder: 'sk-or-v1-...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) return 'Please enter an API key.';
      if (!isValidApiKeyFormat(trimmed))
        return 'Invalid key format. Expected sk-or-v1-... (Open Router format). Get a free key at https://openrouter.ai/keys';
      return null;
    },
  });
  if (!key?.trim()) return false;
  const trimmed = key.trim();
  if (!isValidApiKeyFormat(trimmed)) {
    vscode.window.showErrorMessage('Blue Matter: Invalid API key format. Key was not stored.');
    return false;
  }
  await context.secrets.store(BLUE_MATTER_API_KEY_SECRET, trimmed);
  vscode.window.showInformationMessage(
    'Blue Matter: API key saved securely. You can now use Explain (Cmd+Shift+E).'
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
  await context.secrets.delete(BLUE_MATTER_API_KEY_SECRET);
}

/** Shut down the core instance and clear the singleton. Call from deactivate(). */
export async function shutdownCore(): Promise<void> {
  coreInitPromise = null;
  if (coreInstance) {
    await coreInstance.shutdown();
    coreInstance = null;
    coreConfig = null;
  }
}

export async function getCore(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  storagePath: string,
  userId: string
): Promise<import('@blue-matter/core').BlueMatterCore> {
  // Return existing instance if workspace hasn't changed
  if (coreInstance && coreConfig?.workspaceRoot === workspaceRoot) {
    return coreInstance;
  }
  // If already initializing, wait for that promise rather than starting a second init
  if (coreInitPromise) {
    return coreInitPromise;
  }

  coreInitPromise = (async () => {
    try {
      if (coreInstance) {
        await coreInstance.shutdown();
        coreInstance = null;
      }

      const blueMatter = await import('@blue-matter/core');
      const config = vscode.workspace.getConfiguration('bluematter');
      let apiKey = await resolveApiKey(context);
      if (!apiKey) {
        const configured = await ensureApiKey(context);
        if (!configured) {
          throw new Error(
            'API key is required to explain code. Run "Blue Matter: Set API Key" or set the OPENROUTER_API_KEY environment variable.'
          );
        }
        apiKey = await resolveApiKey(context);
      }

      const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
      const rawModel = config.get<string>('openRouterModel') || DEFAULT_MODEL;
      // Reject model names that don't match the org/model pattern to prevent injection
      const openRouterModel = isValidModelName(rawModel) ? rawModel : DEFAULT_MODEL;

      const rawPrivacy = config.get<string>('privacyMode') || 'standard';
      const privacyMode: 'standard' | 'strict' = rawPrivacy === 'strict' ? 'strict' : 'standard';

      const explanationsPerHour = Math.max(1, Math.min(1000, config.get<number>('explanationsPerHour') ?? 100));

      const storageDir = path.dirname(path.join(storagePath, 'blue-matter.db'));
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      coreInstance = new blueMatter.BlueMatterCore({
        userId,
        storagePath: storageDir,
        workspaceRoot,
        apiKey: apiKey || undefined,
        aiProvider: 'openrouter',
        openRouterModel,
        privacyMode,
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
          excludePatterns: [],
        },
      });
      coreConfig = { workspaceRoot, storagePath, userId };
      await coreInstance.initialize();
      return coreInstance;
    } finally {
      coreInitPromise = null;
    }
  })();

  return coreInitPromise;
}
