/**
 * Pattern-based Python analyzer (no native deps).
 * Detects concepts by scanning source text; sufficient for v1 taxonomy.
 */

export interface ParseResult {
  success: boolean;
  concepts: string[];
  error?: string;
}

const DATA_STRUCTURE_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'list', pattern: /\blist\s*\(/ },
  { id: 'dict', pattern: /\bdict\s*\(/ },
  { id: 'set', pattern: /\bset\s*\(/ },
  { id: 'tuple', pattern: /\btuple\s*\(/ },
  { id: 'deque', pattern: /\bdeque\b/ },
  { id: 'defaultdict', pattern: /\bdefaultdict\b/ },
  { id: 'Counter', pattern: /\bCounter\b/ },
  { id: 'OrderedDict', pattern: /\bOrderedDict\b/ },
];

const LOOP_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'for', pattern: /\bfor\s+\w+/ },
  { id: 'while', pattern: /\bwhile\s+/ },
  { id: 'list_comprehension', pattern: /\]\s*for\s+/ },
  { id: 'dict_comprehension', pattern: /\}\s*for\s+|\bfor\s+.*\s*:\s*[^=]/ },
  { id: 'set_comprehension', pattern: /\{\s*[^:}]+\s+for\s+/ },
  { id: 'generator', pattern: /\(\s*[^)]+\s+for\s+/ },
];

const LIBRARY_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: 'pathlib', pattern: /\b(?:from\s+pathlib\s+import|import\s+pathlib|Path\s*\()/ },
  { id: 'requests', pattern: /\b(?:from\s+requests|import\s+requests|requests\.)/ },
  { id: 'collections', pattern: /\b(?:from\s+collections|import\s+collections|collections\.)/ },
  { id: 'itertools', pattern: /\b(?:from\s+itertools|import\s+itertools|itertools\.)/ },
  { id: 'os', pattern: /\b(?:from\s+os\s+import|import\s+os|os\.)/ },
  { id: 'json', pattern: /\b(?:from\s+json|import\s+json|json\.)/ },
  { id: 're', pattern: /\b(?:from\s+re\s+import|import\s+re|re\.)/ },
  { id: 'dataclasses', pattern: /\b(?:from\s+dataclasses|import\s+dataclasses|@dataclass)/ },
  { id: 'typing', pattern: /\b(?:from\s+typing\s+import|import\s+typing)/ },
];

export function parsePython(source: string): ParseResult {
  const concepts = new Set<string>();
  // Return type is ParseResult so consumers can use optional error

  for (const { id, pattern } of DATA_STRUCTURE_PATTERNS) {
    if (pattern.test(source)) concepts.add(id);
  }
  for (const { id, pattern } of LOOP_PATTERNS) {
    if (pattern.test(source)) concepts.add(id);
  }
  for (const { id, pattern } of LIBRARY_PATTERNS) {
    if (pattern.test(source)) concepts.add(id);
  }

  return {
    success: true,
    concepts: Array.from(concepts).sort(),
  };
}
