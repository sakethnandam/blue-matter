/**
 * BlueMatterCore - main SDK entry point
 */

import type { Explanation } from '../models/Explanation.js';
import type { Symbol } from '../models/Symbol.js';
import type { RepoContext } from '../models/Context.js';
import type { NotebookCellContext } from '../models/Context.js';
import type { BlueMatterConfig } from '../models/Config.js';
import { DEFAULT_CONFIG } from '../models/Config.js';
import { createExplanation } from '../models/Explanation.js';
import { BlueMatterDatabase } from '../storage/Database.js';
import { CodeIndexer } from '../indexer/CodeIndexer.js';
import { ExplanationCache } from '../cache/ExplanationCache.js';
import { ContextBuilder } from '../context/ContextBuilder.js';
import { AIOrchestrator } from '../ai/AIOrchestrator.js';
import { AnnotationManager } from '../annotations/AnnotationManager.js';
import { PathValidator } from '../security/PathValidator.js';
import { InputSanitizer } from '../security/InputSanitizer.js';
import { NotebookContextBuilder } from '../notebook/NotebookContextBuilder.js';
import type { IndexResult, IndexStatus } from '../indexer/CodeIndexer.js';
import type { Annotation } from '../annotations/AnnotationManager.js';
import { createLogger } from '../utils/Logger.js';
import * as path from 'node:path';

export interface ExplainCodeOptions {
  includeContext?: boolean;
  maxContextLines?: number;
  language?: string;
  filePath?: string;
  forceRefresh?: boolean;
  /** Notebook cell context for cross-cell aware explanations (.ipynb and # %% .py files). */
  notebookContext?: NotebookCellContext;
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

export class BlueMatterCore {
  private readonly config: BlueMatterConfig;
  private db: BlueMatterDatabase;
  private indexer: CodeIndexer;
  private cache: ExplanationCache;
  private contextBuilder: ContextBuilder;
  private ai: AIOrchestrator;
  private annotations: AnnotationManager;
  private pathValidator: PathValidator;
  private sanitizer: InputSanitizer;
  private notebookBuilder: NotebookContextBuilder;
  private readonly logger = createLogger();
  private initialized = false;
  private usageCount = { ai: 0, cache: 0 };

  constructor(config: Partial<BlueMatterConfig> & { userId: string; storagePath: string; workspaceRoot: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as BlueMatterConfig;
    const dbPath = path.join(this.config.storagePath, 'blue-matter.db');
    this.db = new BlueMatterDatabase({ path: dbPath, userId: this.config.userId });
    this.pathValidator = new PathValidator(this.config.workspaceRoot);
    this.sanitizer = new InputSanitizer();
    this.indexer = new CodeIndexer(this.db, this.config.userId, this.config.indexing);
    this.cache = new ExplanationCache(this.db, this.config.userId);
    this.contextBuilder = new ContextBuilder(this.indexer, this.cache);
    this.ai = new AIOrchestrator(this.config);
    this.annotations = new AnnotationManager(this.db, this.config.userId);
    this.notebookBuilder = new NotebookContextBuilder();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.db.open();
    this.cache.evictOldEntries(2000);
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    this.db.close();
    this.initialized = false;
  }

  async explainCode(code: string, options: ExplainCodeOptions = {}): Promise<Explanation> {
    await this.initialize();

    // Markdown cells have a distinct explanation path
    if (options.notebookContext?.cellKind === 'markup') {
      return this.explainMarkdownCell(code, options);
    }

    const sanitized = this.sanitizer.sanitizeCode(code);
    const maxSize = this.config.rateLimits.maxCodeBlockSize;
    if (sanitized.length > maxSize) {
      throw new Error(`Code block too large (max ${maxSize} characters)`);
    }

    // Build notebook-aware cache key when context is present.
    // Key = hash(normalizedCode + '\x00' + cellIndex + '\x00' + dependencySummaryHash)
    // This means editing a prior cell's comments (without changing imports/defs)
    // preserves the cache entry — only structural changes invalidate it.
    let codeHash: string;
    let notebookPromptContext: { summary: string; cellIndex: number; cellKind: 'code' | 'markup' } | undefined;

    if (options.notebookContext) {
      const summary = this.notebookBuilder.buildSummary(options.notebookContext);
      const summaryHash = this.notebookBuilder.buildSummaryHash(options.notebookContext);
      codeHash = this.cache.generateHash(
        sanitized,
        `${options.notebookContext.cellIndex}\x00${summaryHash}`
      );
      if (summary) {
        notebookPromptContext = {
          summary,
          cellIndex: options.notebookContext.cellIndex,
          cellKind: options.notebookContext.cellKind,
        };
      }
    } else {
      codeHash = this.cache.generateHash(sanitized);
    }

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
      notebookContext: notebookPromptContext,
    });
    this.usageCount.ai++;

    // Defense in depth: redact any credential-like patterns the AI may have echoed back
    const safeText = this.sanitizer.sanitizeAIResponse(explanation.text);
    const final = safeText !== explanation.text
      ? createExplanation({ ...explanation, text: safeText })
      : explanation;

    this.cache.set(final);
    return final;
  }

  /**
   * Explain a markdown notebook cell.
   * - Sanitizes content (strips HTML comments, detects injection)
   * - If no fenced code blocks: returns a lightweight local response (no AI call)
   * - If code blocks present: calls AI with markdown as context
   */
  private async explainMarkdownCell(markdown: string, options: ExplainCodeOptions): Promise<Explanation> {
    const { sanitized, injectionDetected } = this.sanitizer.sanitizeMarkdownCell(markdown);
    if (injectionDetected) {
      this.logger.warn('Potential prompt injection detected in markdown cell');
    }

    const codeBlocks = this.extractFencedCodeBlocks(sanitized);

    // No code blocks → don't waste AI tokens; return a simple adapted response
    if (codeBlocks.length === 0) {
      return createExplanation({
        codeHash: this.cache.generateHash(sanitized),
        text: 'This is a documentation (markdown) cell. It contains descriptive text without embedded code examples.',
        summary: 'Markdown documentation cell',
        source: 'adapted',
        metadata: { language: 'markdown', filePath: options.filePath },
      });
    }

    // Has code blocks → explain them via AI, with markdown as surrounding context
    const combinedCode = codeBlocks.join('\n\n');
    const sanitizedCode = this.sanitizer.sanitizeCode(combinedCode);
    const codeHash = this.cache.generateHash(sanitizedCode);

    if (!options.forceRefresh) {
      const cached = this.cache.get(codeHash);
      if (cached) {
        this.usageCount.cache++;
        return cached;
      }
    }

    const notebookPromptContext = options.notebookContext
      ? {
          summary: `Surrounding markdown context:\n${sanitized.slice(0, 500)}`,
          cellIndex: options.notebookContext.cellIndex,
          cellKind: 'markup' as const,
        }
      : undefined;

    const explanation = await this.ai.explainMarkdown(sanitized, {
      codeHash,
      filePath: options.filePath,
      notebookContext: notebookPromptContext,
    });
    this.usageCount.ai++;

    const safeText = this.sanitizer.sanitizeAIResponse(explanation.text);
    const final = safeText !== explanation.text
      ? createExplanation({ ...explanation, text: safeText })
      : explanation;

    this.cache.set(final);
    return final;
  }

  private extractFencedCodeBlocks(markdown: string): string[] {
    const blocks: string[] = [];
    // Match ``` or ~~~ fenced blocks; language hint on opening line is optional
    const re = /(?:```|~~~)[^\n`~]*\n([\s\S]*?)(?:```|~~~)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const block = m[1].trim();
      if (block) blocks.push(block);
    }
    return blocks;
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
    // Ensure rootPath is the workspace root or a subdirectory of it
    const resolvedRoot = path.resolve(rootPath);
    const workspaceRoot = path.resolve(this.config.workspaceRoot);
    if (resolvedRoot !== workspaceRoot && !resolvedRoot.startsWith(workspaceRoot + path.sep)) {
      throw new Error('indexRepository: rootPath must be within the workspace');
    }
    return this.indexer.indexRepository(resolvedRoot);
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

  updateConfig(updates: Partial<BlueMatterConfig>): void {
    Object.assign(this.config, updates);
    if (updates.apiKey && updates.aiProvider) {
      this.ai.setApiKey(updates.apiKey);
    }
  }

  getConfig(): BlueMatterConfig {
    return { ...this.config };
  }
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (ext === 'py' || ext === 'ipynb') return 'python';
  return ext || 'unknown';
}
