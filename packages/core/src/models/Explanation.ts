/**
 * Explanation model - represents a cached or generated code explanation
 */

export interface Concept {
  id: string;
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  resources?: Resource[];
}

export interface Resource {
  type: 'documentation' | 'video' | 'article';
  url: string;
  title: string;
  description?: string;
}

export interface SymbolReference {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type';
  filePath: string;
  lineNumber: number;
  definition?: string;
}

export interface ExplanationMetadata {
  language: string;
  filePath?: string;
  lineRange?: [number, number];
  aiProvider?: 'anthropic' | 'openai' | 'openrouter' | 'local';
  tokenCount?: number;
  cost?: number;
  userFeedback?: 'positive' | 'negative';
}

export interface Explanation {
  id: string;
  codeHash: string;
  text: string;
  summary: string;
  concepts: Concept[];
  confidence: number;
  source: 'ai' | 'cache' | 'user_annotation' | 'adapted';
  relatedSymbols: SymbolReference[];
  relatedFiles: string[];
  metadata: ExplanationMetadata;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
}

export function createExplanation(partial: Partial<Explanation> & { codeHash: string; text: string }): Explanation {
  const now = new Date();
  return {
    id: partial.id ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    codeHash: partial.codeHash,
    text: partial.text,
    summary: partial.summary ?? partial.text.slice(0, 100),
    concepts: partial.concepts ?? [],
    confidence: partial.confidence ?? 0.9,
    source: partial.source ?? 'ai',
    relatedSymbols: partial.relatedSymbols ?? [],
    relatedFiles: partial.relatedFiles ?? [],
    metadata: partial.metadata ?? { language: 'unknown' },
    createdAt: partial.createdAt ?? now,
    accessedAt: partial.accessedAt ?? now,
    accessCount: partial.accessCount ?? 0,
  };
}
