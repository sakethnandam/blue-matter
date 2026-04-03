/**
 * Context model - repository context for AI prompts
 */

import type { Symbol } from './Symbol.js';
import type { Explanation } from './Explanation.js';

export interface FileInfo {
  path: string;
  summary: string;
  exports: string[];
  language: string;
}

export interface ImportNode {
  filePath: string;
  exports: string[];
}

export interface ImportEdge {
  from: string;
  to: string;
  imports: string[];
}

export interface ImportGraph {
  nodes: ImportNode[];
  edges: ImportEdge[];
}

export interface RepoContext {
  repoMap: string;
  relevantFiles: FileInfo[];
  symbolDefinitions: Symbol[];
  importGraph: ImportGraph;
  similarPatterns: Explanation[];
}

export interface NotebookPrecedingCell {
  index: number;
  kind: 'code' | 'markup';
  source: string;
}

export interface NotebookCellContext {
  cellIndex: number;
  cellKind: 'code' | 'markup';
  totalCells: number;
  precedingCells: NotebookPrecedingCell[];
}
