/**
 * Context builder - builds repo context for AI prompts
 */

import type { RepoContext, FileInfo } from '../models/Context.js';
import type { Symbol } from '../models/Symbol.js';
import type { CodeIndexer } from '../indexer/CodeIndexer.js';
import type { ExplanationCache } from '../cache/ExplanationCache.js';
import { generateRepoMap } from './RepoMapGenerator.js';

export interface BuildContextOptions {
  filePath?: string;
  maxSymbols?: number;
  maxFiles?: number;
}

export class ContextBuilder {
  constructor(
    private readonly indexer: CodeIndexer,
    private readonly cache: ExplanationCache
  ) {}

  async build(code: string, options: BuildContextOptions = {}): Promise<RepoContext> {
    const filePath = options.filePath;
    const maxSymbols = options.maxSymbols ?? 20;
    const maxFiles = options.maxFiles ?? 30;

    const indexed = this.indexer.getIndexedFiles();
    const relevantFiles: FileInfo[] = indexed.slice(0, maxFiles).map((f) => ({
      path: f.path,
      summary: '',
      exports: f.exports,
      language: f.language,
    }));

    const symbolDefinitions: Symbol[] = [];
    if (filePath) {
      const symbols = this.indexer.getSymbolsForFile(filePath);
      symbolDefinitions.push(...symbols.slice(0, maxSymbols));
    }

    const importGraph = { nodes: [] as { filePath: string; exports: string[] }[], edges: [] as { from: string; to: string; imports: string[] }[] };
    const similarPatterns = this.cache.findSimilar(code, 0.8);

    const repoMap = generateRepoMap(
      relevantFiles,
      symbolDefinitions,
      filePath,
      maxFiles
    );

    return {
      repoMap,
      relevantFiles,
      symbolDefinitions,
      importGraph,
      similarPatterns,
    };
  }
}
