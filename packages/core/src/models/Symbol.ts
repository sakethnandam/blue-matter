/**
 * Symbol model - represents a code entity (function, class, variable, etc.)
 */

export type SymbolType = 'function' | 'class' | 'variable' | 'type' | 'interface';

export interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
  description?: string;
}

export interface SymbolMetadata {
  language: string;
  isExported: boolean;
  isAsync?: boolean;
  parameters?: Parameter[];
  returnType?: string;
}

export interface ExportInfo {
  isDefault: boolean;
  isNamed: boolean;
  exportName?: string;
}

export interface Symbol {
  id: string;
  name: string;
  type: SymbolType;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  definition: string;
  signature?: string;
  documentation?: string;
  dependencies: string[];
  exports?: ExportInfo;
  metadata: SymbolMetadata;
}

export function createSymbol(partial: Partial<Symbol> & { name: string; type: SymbolType; filePath: string; lineStart: number; lineEnd: number }): Symbol {
  return {
    id: partial.id ?? `sym_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: partial.name,
    type: partial.type,
    filePath: partial.filePath,
    lineStart: partial.lineStart,
    lineEnd: partial.lineEnd,
    definition: partial.definition ?? '',
    signature: partial.signature,
    documentation: partial.documentation,
    dependencies: partial.dependencies ?? [],
    exports: partial.exports,
    metadata: partial.metadata ?? { language: 'unknown', isExported: false },
  };
}
