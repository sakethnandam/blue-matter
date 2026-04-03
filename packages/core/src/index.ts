/**
 * @blue-matter/core - Platform-agnostic code intelligence engine
 */

export { BlueMatterCore } from './core/BlueMatterCore.js';
export type { ExplainCodeOptions, ExplainFileOptions, CacheStats, UsageStats } from './core/BlueMatterCore.js';
export type { BlueMatterConfig, RateLimits, IndexingConfig } from './models/Config.js';
export type { Explanation, ExplanationMetadata, Concept, SymbolReference } from './models/Explanation.js';
export type { Symbol, SymbolType, SymbolMetadata } from './models/Symbol.js';
export type { RepoContext, FileInfo, ImportGraph } from './models/Context.js';
export type { Annotation } from './annotations/AnnotationManager.js';
export type { IndexResult, IndexStatus, IndexError } from './indexer/CodeIndexer.js';
export { createExplanation } from './models/Explanation.js';
export { createSymbol } from './models/Symbol.js';
export { DEFAULT_CONFIG, DEFAULT_RATE_LIMITS, DEFAULT_INDEXING_CONFIG } from './models/Config.js';
export { SecurityError } from './security/PathValidator.js';
export { DEFAULT_OPENROUTER_FREE_MODEL } from './ai/providers/OpenRouterProvider.js';
