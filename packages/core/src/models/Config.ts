/**
 * Configuration types for UntitledCore
 */

export interface RateLimits {
  explanationsPerHour: number;
  explanationsPerDay: number;
  maxConcurrentRequests: number;
  maxCodeBlockSize: number;
}

export interface IndexingConfig {
  autoIndex: boolean;
  debounceMs: number;
  maxFilesToIndex: number;
  maxTotalSizeBytes: number;
  excludePatterns: string[];
}

export interface UntitledConfig {
  userId: string;
  storagePath: string;
  workspaceRoot: string;
  apiKey?: string;
  aiProvider: 'anthropic' | 'openai' | 'openrouter' | 'local';
  /** Open Router model id (e.g. nvidia/nemotron-3-nano-30b-a3b:free). Used when aiProvider is 'openrouter'. */
  openRouterModel?: string;
  cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
  privacyMode: 'standard' | 'strict';
  rateLimits: RateLimits;
  indexing: IndexingConfig;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  explanationsPerHour: 100,
  explanationsPerDay: 1000,
  maxConcurrentRequests: 3,
  maxCodeBlockSize: 50000,
};

export const DEFAULT_INDEXING_CONFIG: IndexingConfig = {
  autoIndex: true,
  debounceMs: 1000,
  maxFilesToIndex: 10000,
  maxTotalSizeBytes: 50 * 1024 * 1024, // 50MB
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
};

export const DEFAULT_CONFIG: Partial<UntitledConfig> = {
  aiProvider: 'openrouter',
  openRouterModel: 'nvidia/nemotron-3-nano-30b-a3b:free',
  cacheStrategy: 'balanced',
  privacyMode: 'standard',
  rateLimits: DEFAULT_RATE_LIMITS,
  indexing: DEFAULT_INDEXING_CONFIG,
};
