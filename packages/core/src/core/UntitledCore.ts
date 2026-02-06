/**
 * UntitledCore - main SDK entry point
 */

import type { Explanation } from '../models/Explanation.js';
import type { Symbol } from '../models/Symbol.js';
import type { RepoContext } from '../models/Context.js';
import type { UntitledConfig } from '../models/Config.js';
import { DEFAULT_CONFIG } from '../models/Config.js';
import { UntitledDatabase } from '../storage/Database.js';
import { CodeIndexer } from '../indexer/CodeIndexer.js';
import { ExplanationCache } from '../cache/ExplanationCache.js';
import { ContextBuilder } from '../context/ContextBuilder.js';
import { AIOrchestrator } from '../ai/AIOrchestrator.js';
import { AnnotationManager } from '../annotations/AnnotationManager.js';
import { PathValidator } from '../security/PathValidator.js';
import { InputSanitizer } from '../security/InputSanitizer.js';
import type { IndexResult, IndexStatus } from '../indexer/CodeIndexer.js';
import type { Annotation } from '../annotations/AnnotationManager.js';
import * as path from 'node:path';

export interface ExplainCodeOptions {
  includeContext?: boolean;
  maxContextLines?: number;
  language?: string;
  filePath?: string;
  forceRefresh?: boolean;
}

export interface ExplainFileOptions {
  includeSymbols?: boolean;
  includeDependencies?: boolean;
  maxDepth?: number;
}

export interface CacheStats {
  totalExplanations: number;
  cacheHitRate: number;
  cacheSizeBytes: number;
  averageExplanationTime: number;
  costSaved: number;
}

export interface UsageStats {
  totalExplanations: number;
  cachedExplanations: number;
  aiExplanations: number;
  totalCost: number;
  averageCostPerExplanation: number;
  conceptsLearned: number;
  annotationsCreated: number;
}

export class UntitledCore {
  private readonly config: UntitledConfig;
  private db: UntitledDatabase;
  private indexer: CodeIndexer;
  private cache: ExplanationCache;
  private contextBuilder: ContextBuilder;
  private ai: AIOrchestrator;
  private annotations: AnnotationManager;
  private pathValidator: PathValidator;
  private sanitizer: InputSanitizer;
  private initialized = false;
  private usageCount = { ai: 0, cache: 0 };

  constructor(config: Partial<UntitledConfig> & { userId: string; storagePath: string; workspaceRoot: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as UntitledConfig;
    const dbPath = path.join(this.config.storagePath, 'untitled.db');
    this.db = new UntitledDatabase({ path: dbPath, userId: this.config.userId });
    this.pathValidator = new PathValidator(this.config.workspaceRoot);
    this.sanitizer = new InputSanitizer();
    this.indexer = new CodeIndexer(this.db, this.config.userId, this.config.indexing);
    this.cache = new ExplanationCache(this.db, this.config.userId);
    this.contextBuilder = new ContextBuilder(this.indexer, this.cache);
    this.ai = new AIOrchestrator(this.config);
    this.annotations = new AnnotationManager(this.db, this.config.userId);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.db.open();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.db.close();
    this.initialized = false;
  }

  async explainCode(code: string, options: ExplainCodeOptions = {}): Promise<Explanation> {
    await this.initialize();
    const sanitized = this.sanitizer.sanitizeCode(code);
    const maxSize = this.config.rateLimits.maxCodeBlockSize;
    if (sanitized.length > maxSize) {
      throw new Error(`Code block too large (max ${maxSize} characters)`);
    }
    const codeHash = this.cache.generateHash(sanitized);
    if (!options.forceRefresh) {
      const cached = this.cache.get(codeHash);
      if (cached) {
        this.usageCount.cache++;
        return cached;
      }
    }
    const context = await this.contextBuilder.build(sanitized, {
      filePath: options.filePath,
      maxSymbols: 20,
      maxFiles: 30,
    });
    const explanation = await this.ai.explain(sanitized, context, {
      codeHash,
      filePath: options.filePath,
      language: options.language,
    });
    this.usageCount.ai++;
    this.cache.set(explanation);
    return explanation;
  }

  async explainFile(filePath: string, _options: ExplainFileOptions = {}): Promise<Explanation> {
    await this.initialize();
    const validated = this.pathValidator.validatePath(filePath);
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(validated, 'utf-8');
    return this.explainCode(content, { filePath: validated, language: detectLanguage(validated) });
  }

  async explainSymbol(symbolName: string, filePath: string): Promise<Explanation | null> {
    await this.initialize();
    const sym = this.indexer.findSymbol(symbolName);
    if (!sym || sym.filePath !== filePath) return null;
    return this.explainCode(sym.definition, { filePath: sym.filePath, language: sym.metadata?.language });
  }

  async indexRepository(rootPath: string): Promise<IndexResult> {
    await this.initialize();
    return this.indexer.indexRepository(rootPath);
  }

  async indexFile(filePath: string): Promise<number> {
    await this.initialize();
    const validated = this.pathValidator.validatePath(filePath);
    return this.indexer.indexFile(validated);
  }

  getIndexStatus(): IndexStatus {
    return this.indexer.getIndexStatus();
  }

  async getContext(code: string, filePath?: string): Promise<RepoContext> {
    await this.initialize();
    return this.contextBuilder.build(code, { filePath });
  }

  findSymbol(name: string): Symbol | undefined {
    return this.indexer.findSymbol(name);
  }

  createAnnotation(codeHash: string, text: string, tags?: string[]): Annotation {
    return this.annotations.createAnnotation(codeHash, text, tags ?? []);
  }

  getAnnotations(codeHash: string): Annotation[] {
    return this.annotations.getAnnotations(codeHash);
  }

  /** Generate cache key (hash) for a code string. Use for annotations. */
  getCodeHash(code: string): string {
    return this.cache.generateHash(this.sanitizer.sanitizeCode(code));
  }

  searchAnnotations(query: string): Annotation[] {
    return this.annotations.searchAnnotations(query);
  }

  getCacheStats(): CacheStats {
    const { total } = this.cache.getStats();
    const hitRate = this.usageCount.cache + this.usageCount.ai > 0
      ? this.usageCount.cache / (this.usageCount.cache + this.usageCount.ai)
      : 0;
    return {
      totalExplanations: total,
      cacheHitRate: hitRate,
      cacheSizeBytes: 0,
      averageExplanationTime: 0,
      costSaved: this.usageCount.cache * 0.02,
    };
  }

  getUsageStats(): UsageStats {
    const total = this.usageCount.ai + this.usageCount.cache;
    return {
      totalExplanations: total,
      cachedExplanations: this.usageCount.cache,
      aiExplanations: this.usageCount.ai,
      totalCost: this.usageCount.ai * 0.02,
      averageCostPerExplanation: total > 0 ? (this.usageCount.ai * 0.02) / total : 0,
      conceptsLearned: 0,
      annotationsCreated: 0,
    };
  }

  updateConfig(updates: Partial<UntitledConfig>): void {
    Object.assign(this.config, updates);
    if (updates.apiKey && updates.aiProvider) {
      this.ai.setApiKey(updates.apiKey);
    }
  }

  getConfig(): UntitledConfig {
    return { ...this.config };
  }
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (ext === 'py') return 'python';
  return ext || 'unknown';
}
